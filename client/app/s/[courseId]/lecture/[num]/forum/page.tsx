'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronUp, MessageCircle } from 'lucide-react'
import type { Question, Reply } from '@/lib/api'
import { listLectures, listQuestions, postQuestion, upvoteQuestion, postReply, getReplies, escalateQuestion } from '@/lib/api'

const ANON_NAMES = ['Koala', 'Penguin', 'Mango', 'Orbit', 'Pixel', 'Nova', 'Echo', 'Blaze', 'Comet', 'Fern']

function anonIdFor(id: string) {
  let hash = 0
  for (const c of id) hash = (hash * 31 + c.charCodeAt(0)) & 0xffff
  return hash
}

function timeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return `${Math.floor(diff / 3600)}h ago`
}

function AITypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.25 }}
      className="px-4 py-3 bg-surface-container flex gap-2.5 items-center"
    >
      <div className="shrink-0 w-6 h-6 bg-on-surface rounded-full flex items-center justify-center text-surface-container-lowest font-label text-[10px] font-bold">
        AI
      </div>
      <div className="flex items-center gap-2">
        <span className="font-label text-xs text-on-surface-variant">AI is generating an answer</span>
        <div className="flex gap-0.5 items-center">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-on-surface-variant"
              animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
              transition={{
                duration: 1.2,
                repeat: Infinity,
                delay: i * 0.2,
                ease: 'easeInOut',
              }}
            />
          ))}
        </div>
      </div>
    </motion.div>
  )
}

interface QuestionCardProps {
  q: Question
  hasUpvoted: boolean
  onUpvote: (id: string) => void
  autoOpenReplies?: boolean
}

function QuestionCard({ q, hasUpvoted, onUpvote, autoOpenReplies }: QuestionCardProps) {
  const hash = anonIdFor(q.id)
  const name = ANON_NAMES[hash % ANON_NAMES.length]

  const [replies, setReplies] = useState<Reply[]>([])
  const [showReplies, setShowReplies] = useState(false)
  const [replying, setReplying] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [submittingReply, setSubmittingReply] = useState(false)
  const [loadingReplies, setLoadingReplies] = useState(false)
  const [awaitingAI, setAwaitingAI] = useState(false)
  const [escalated, setEscalated] = useState(q.escalated_to_prof)
  const [escalating, setEscalating] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  async function loadReplies() {
    if (loadingReplies) return
    setLoadingReplies(true)
    try {
      const data = await getReplies(q.id)
      setReplies(data)
    } finally {
      setLoadingReplies(false)
    }
  }

  // Auto-open + poll for AI reply when this question was just posted
  useEffect(() => {
    if (!autoOpenReplies) return
    setShowReplies(true)
    setAwaitingAI(true)
    loadReplies()

    let attempts = 0
    const interval = setInterval(async () => {
      attempts++
      const data = await getReplies(q.id)
      setReplies(data)
      if (data.some((r) => r.is_ai) || attempts >= 10) {
        clearInterval(interval)
        setAwaitingAI(false)
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [autoOpenReplies])

  async function handleToggleReplies() {
    if (!showReplies && replies.length === 0) {
      await loadReplies()
    }
    setShowReplies((v) => !v)
  }

  async function handleReply(e: React.FormEvent) {
    e.preventDefault()
    if (!replyText.trim()) return
    setSubmittingReply(true)
    try {
      const r = await postReply(q.id, replyText.trim())
      setReplies((prev) => [...prev, r])
      setReplyText('')
      setReplying(false)
      setShowReplies(true)
    } finally {
      setSubmittingReply(false)
    }
  }

  async function handleEscalate() {
    setEscalating(true)
    try {
      await escalateQuestion(q.id)
      setEscalated(true)
    } finally {
      setEscalating(false)
    }
  }

  function handleReplyClick() {
    setReplying(true)
    setShowReplies(true)
    setTimeout(() => textareaRef.current?.focus(), 50)
  }

  const aiReply = replies.find((r) => r.is_ai)
  const otherReplies = replies.filter((r) => !r.is_ai)
  const showAITyping = awaitingAI && !aiReply

  return (
    <div className="bg-surface-container-lowest rounded-lg shadow-card overflow-hidden">
      <div className="p-4 flex gap-3">
        {/* Upvote */}
        <button
          onClick={() => onUpvote(q.id)}
          disabled={hasUpvoted}
          className={`flex flex-col items-center shrink-0 w-8 pt-0.5 rounded-lg transition-colors ${
            hasUpvoted ? 'text-on-surface' : 'text-outline hover:text-on-surface-variant'
          }`}
        >
          <ChevronUp className="w-4 h-4" />
          <span className="font-label text-xs font-bold mt-0.5">{q.upvotes}</span>
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-on-surface leading-relaxed">{q.question_text}</p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="font-label text-xs bg-surface-container text-on-surface-variant px-2 py-0.5 rounded-full">
              Anon {name}
            </span>
            <span className="font-label text-xs text-outline">{timeAgo(q.created_at)}</span>
            {escalated && (
              <span className="font-label text-xs bg-surface-container text-on-surface-variant px-2 py-0.5 rounded-full">
                Forwarded to professor
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Footer actions */}
      <div className="px-4 pb-3 flex items-center gap-3 border-t border-surface-container pt-2.5">
        <button
          onClick={handleToggleReplies}
          className="flex items-center gap-1.5 font-label text-xs text-on-surface-variant hover:text-on-surface transition-colors"
        >
          <MessageCircle className="w-3.5 h-3.5" />
          <span>{replies.length > 0 ? `${replies.length} repl${replies.length === 1 ? 'y' : 'ies'}` : 'Replies'}</span>
          <span className="text-[10px]">{showReplies ? '▲' : '▼'}</span>
        </button>
        <button
          onClick={handleReplyClick}
          className="font-label text-xs text-on-surface-variant hover:text-on-surface font-semibold transition-colors"
        >
          Reply
        </button>
        {/* Live indicator when AI is typing */}
        {showAITyping && !showReplies && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="font-label text-[10px] text-on-surface-variant flex items-center gap-1 ml-auto"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-on-surface-variant animate-pulse" />
            AI answering…
          </motion.span>
        )}
      </div>

      {/* Replies section */}
      <AnimatePresence>
        {showReplies && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="border-t border-surface-container bg-surface-container-low overflow-hidden"
          >
            {/* AI typing indicator — shown while waiting, above any existing replies */}
            <AnimatePresence>
              {showAITyping && <AITypingIndicator />}
            </AnimatePresence>

            {!loadingReplies && (
              <div className="divide-y divide-surface-container">
                {/* AI reply */}
                {aiReply && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="px-4 py-3 bg-surface-container"
                  >
                    <div className="flex gap-2.5">
                      <div className="shrink-0 mt-0.5 w-6 h-6 bg-on-surface rounded-full flex items-center justify-center text-surface-container-lowest font-label text-[10px] font-bold">
                        AI
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="font-label text-xs font-semibold text-on-surface">AI Assistant</span>
                          <span className="font-label text-[10px] text-outline">{timeAgo(aiReply.created_at)}</span>
                        </div>
                        <p className="text-sm text-on-surface leading-relaxed">{aiReply.reply_text}</p>
                      </div>
                    </div>
                    {!escalated ? (
                      <div className="mt-3 flex items-center gap-2">
                        <span className="font-label text-xs text-on-surface-variant">Not satisfied?</span>
                        <button
                          onClick={handleEscalate}
                          disabled={escalating}
                          className="font-label text-xs font-semibold text-on-surface underline underline-offset-2 disabled:opacity-50 transition-colors"
                        >
                          {escalating ? 'Forwarding…' : 'Ask professor →'}
                        </button>
                      </div>
                    ) : (
                      <p className="mt-2 font-label text-xs text-on-surface-variant">✓ Forwarded to your professor</p>
                    )}
                  </motion.div>
                )}

                {/* Other replies */}
                {otherReplies.map((r) => (
                  <div key={r.id} className="px-4 py-3 flex gap-2.5">
                    <div className={`shrink-0 mt-0.5 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      r.is_professor ? 'bg-on-surface text-surface-container-lowest' : 'bg-surface-container-highest text-on-surface-variant'
                    }`}>
                      {r.is_professor ? 'P' : 'A'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="font-label text-xs font-semibold text-on-surface">
                          {r.is_professor ? 'Professor' : 'Anonymous'}
                        </span>
                        <span className="font-label text-[10px] text-outline">{timeAgo(r.created_at)}</span>
                      </div>
                      <p className="text-sm text-on-surface leading-relaxed">{r.reply_text}</p>
                    </div>
                  </div>
                ))}

                {replies.length === 0 && !showAITyping && !replying && (
                  <p className="font-label text-xs text-on-surface-variant text-center py-4">No replies yet</p>
                )}
              </div>
            )}

            {/* Reply input */}
            {replying && (
              <form onSubmit={handleReply} className="px-4 pb-4 pt-2 border-t border-surface-container">
                <textarea
                  ref={textareaRef}
                  className="w-full text-sm bg-surface-container-lowest rounded-lg px-3 py-2.5 resize-none focus:outline-none focus:ring-1 focus:ring-outline min-h-[72px] placeholder:text-outline"
                  placeholder="Write a reply..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                />
                <div className="flex gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => { setReplying(false); setReplyText('') }}
                    className="flex-1 py-2 font-label text-xs text-on-surface-variant border border-outline-variant rounded-full hover:bg-surface-container transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingReply || !replyText.trim()}
                    className="flex-1 py-2 font-label text-xs font-semibold bg-primary text-on-primary rounded-full hover:bg-primary-container disabled:opacity-40 transition-colors"
                  >
                    {submittingReply ? '…' : 'Post reply'}
                  </button>
                </div>
              </form>
            )}
            {!replying && showReplies && (
              <div className="px-4 pb-3">
                <button
                  onClick={handleReplyClick}
                  className="w-full font-label text-xs text-on-surface-variant border border-dashed border-outline-variant rounded-lg py-2 hover:text-on-surface hover:border-outline transition-colors"
                >
                  + Write a reply
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function ForumPage() {
  const { courseId, num } = useParams<{ courseId: string; num: string }>()
  const [lectureId, setLectureId] = useState<string | null>(null)
  const [lectureTitle, setLectureTitle] = useState('')
  const [questions, setQuestions] = useState<Question[]>([])
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [upvoted, setUpvoted] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [justPosted, setJustPosted] = useState(false)
  const [newQuestionId, setNewQuestionId] = useState<string | null>(null)

  useEffect(() => {
    listLectures(courseId).then((lectures) => {
      const lec = lectures.find((l) => l.lecture_number === parseInt(num))
      if (lec) {
        setLectureId(lec.id)
        setLectureTitle(lec.title)
        return listQuestions(lec.id)
      }
      return []
    })
    .then(setQuestions)
    .finally(() => setLoading(false))
  }, [courseId, num])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim() || !lectureId) return
    setSubmitting(true)
    try {
      const q = await postQuestion(lectureId, text)
      setQuestions((prev) => [q, ...prev])
      setText('')
      setNewQuestionId(q.id)
      setJustPosted(true)
      setTimeout(() => setJustPosted(false), 3000)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleUpvote(qId: string) {
    if (upvoted.has(qId)) return
    await upvoteQuestion(qId)
    setUpvoted((prev) => new Set(prev).add(qId))
    setQuestions((prev) =>
      [...prev.map((q) => (q.id === qId ? { ...q, upvotes: q.upvotes + 1 } : q))]
        .sort((a, b) => b.upvotes - a.upvotes)
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="w-5 h-5 border-2 border-on-surface-variant border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-surface pb-20">
      {/* Sticky header */}
      <div className="bg-surface-container-lowest/80 backdrop-blur border-b border-outline-variant/40 sticky top-0 z-10 px-4 py-4 text-center">
        <div className="inline-flex items-center gap-1.5 bg-surface-container text-on-surface-variant font-label text-xs font-semibold px-3 py-1 rounded-full mb-1">
          Live Q&A
        </div>
        <h1 className="font-headline font-[500] text-sm text-on-surface mt-0.5 leading-tight truncate max-w-xs mx-auto">{lectureTitle}</h1>
        <p className="font-label text-xs text-on-surface-variant mt-0.5">Lecture {num} · Ask anything, anonymously</p>
      </div>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-4">
        {/* Ask input */}
        <div className="bg-surface-container-lowest rounded-lg shadow-card p-4">
          <AnimatePresence>
            {justPosted && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="font-label text-xs text-on-surface bg-surface-container rounded-lg px-3 py-2 mb-3 flex items-center gap-2"
              >
                <span>✓</span> Question posted!
              </motion.div>
            )}
          </AnimatePresence>
          <form onSubmit={handleSubmit}>
            <textarea
              className="w-full text-sm bg-transparent focus:outline-none resize-none placeholder:text-outline min-h-[72px] text-on-surface"
              placeholder="What's on your mind? Ask away..."
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <div className="flex items-center justify-between pt-2 border-t border-surface-container mt-2">
              <span className="font-label text-xs text-outline">Posting anonymously</span>
              <motion.button
                type="submit"
                disabled={submitting || !text.trim()}
                whileTap={{ scale: 0.97 }}
                className="px-4 py-1.5 bg-primary text-on-primary font-label text-xs font-semibold rounded-full hover:bg-primary-container disabled:opacity-40 transition-colors"
              >
                {submitting ? '…' : 'Ask'}
              </motion.button>
            </div>
          </form>
        </div>

        {/* Stats */}
        {questions.length > 0 && (
          <div className="flex items-center gap-2 px-1">
            <span className="font-label text-xs text-on-surface-variant">
              {questions.length} question{questions.length !== 1 ? 's' : ''}
            </span>
            <span className="text-outline">·</span>
            <span className="font-label text-xs text-outline">sorted by votes</span>
          </div>
        )}

        {/* Questions */}
        {questions.length === 0 ? (
          <div className="text-center py-12">
            <p className="font-label text-sm text-on-surface-variant">No questions yet. Be the first!</p>
          </div>
        ) : (
          <motion.div
            className="space-y-3"
            initial="hidden"
            animate="show"
            variants={{ show: { transition: { staggerChildren: 0.05 } } }}
          >
            {questions.map((q) => (
              <motion.div
                key={q.id}
                variants={{
                  hidden: { opacity: 0, y: 8 },
                  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 200, damping: 22 } }
                }}
              >
                <QuestionCard
                  q={q}
                  hasUpvoted={upvoted.has(q.id)}
                  onUpvote={handleUpvote}
                  autoOpenReplies={q.id === newQuestionId}
                />
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </main>
  )
}
