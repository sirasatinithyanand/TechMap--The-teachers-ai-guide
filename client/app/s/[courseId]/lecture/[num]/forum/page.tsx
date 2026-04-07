'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import type { Question, Reply } from '@/lib/api'
import { listLectures, listQuestions, postQuestion, upvoteQuestion, postReply, getReplies, escalateQuestion } from '@/lib/api'

const ANON_COLORS = [
  'bg-purple-100 text-purple-700',
  'bg-blue-100 text-blue-700',
  'bg-green-100 text-green-700',
  'bg-rose-100 text-rose-700',
  'bg-amber-100 text-amber-700',
  'bg-teal-100 text-teal-700',
]
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

interface QuestionCardProps {
  q: Question
  hasUpvoted: boolean
  onUpvote: (id: string) => void
  autoOpenReplies?: boolean
}

function QuestionCard({ q, hasUpvoted, onUpvote, autoOpenReplies }: QuestionCardProps) {
  const hash = anonIdFor(q.id)
  const colorClass = ANON_COLORS[hash % ANON_COLORS.length]
  const name = ANON_NAMES[hash % ANON_NAMES.length]

  const [replies, setReplies] = useState<Reply[]>([])
  const [showReplies, setShowReplies] = useState(false)
  const [replying, setReplying] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [submittingReply, setSubmittingReply] = useState(false)
  const [loadingReplies, setLoadingReplies] = useState(false)
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

  // Auto-open replies for newly posted questions so the AI answer loads
  useEffect(() => {
    if (autoOpenReplies) {
      setShowReplies(true)
      loadReplies()
    }
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

  return (
    <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
      <div className="p-4 flex gap-3">
        {/* Upvote */}
        <button
          onClick={() => onUpvote(q.id)}
          disabled={hasUpvoted}
          className={`flex flex-col items-center shrink-0 w-9 pt-1 rounded-xl transition-all ${
            hasUpvoted ? 'text-purple-600' : 'text-gray-300 hover:text-purple-400 active:scale-90'
          }`}
        >
          <span className="text-base leading-none">▲</span>
          <span className="text-xs font-bold mt-0.5">{q.upvotes}</span>
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-800 leading-relaxed">{q.question_text}</p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colorClass}`}>
              Anon {name}
            </span>
            <span className="text-xs text-gray-300">{timeAgo(q.created_at)}</span>
            {escalated && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                Forwarded to professor
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Footer actions */}
      <div className="px-4 pb-3 flex items-center gap-3 border-t border-gray-50 pt-2.5">
        <button
          onClick={handleToggleReplies}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-purple-500 transition font-medium"
        >
          <span>💬</span>
          <span>{replies.length > 0 ? `${replies.length} repl${replies.length === 1 ? 'y' : 'ies'}` : 'Replies'}</span>
          {showReplies ? <span className="text-[10px]">▲</span> : <span className="text-[10px]">▼</span>}
        </button>
        <button
          onClick={handleReplyClick}
          className="text-xs text-purple-500 hover:text-purple-700 font-semibold transition"
        >
          Reply
        </button>
      </div>

      {/* Replies section */}
      {showReplies && (
        <div className="border-t border-gray-100 bg-gray-50">
          {loadingReplies ? (
            <div className="flex items-center justify-center gap-2 py-4">
              <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-gray-400">AI is generating an answer…</span>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {/* AI reply — shown first, prominently */}
              {aiReply && (
                <div className="px-4 py-3 bg-indigo-50/60">
                  <div className="flex gap-2.5">
                    <div className="shrink-0 mt-0.5">
                      <span className="w-6 h-6 bg-indigo-500 rounded-full flex items-center justify-center text-white text-[10px]">🤖</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-xs font-semibold text-indigo-700">AI Assistant</span>
                        <span className="text-[10px] text-gray-300">{timeAgo(aiReply.created_at)}</span>
                      </div>
                      <p className="text-sm text-gray-700 leading-relaxed">{aiReply.reply_text}</p>
                    </div>
                  </div>
                  {/* Escalate button — only shown after AI has answered */}
                  {!escalated ? (
                    <div className="mt-3 flex items-center gap-2">
                      <span className="text-xs text-gray-400">Not satisfied with this answer?</span>
                      <button
                        onClick={handleEscalate}
                        disabled={escalating}
                        className="text-xs font-semibold text-amber-600 hover:text-amber-700 underline underline-offset-2 disabled:opacity-50 transition"
                      >
                        {escalating ? 'Forwarding…' : 'Ask professor →'}
                      </button>
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-amber-600 font-medium">✓ Forwarded to your professor</p>
                  )}
                </div>
              )}

              {/* Other (student / professor) replies */}
              {otherReplies.map((r) => (
                <div key={r.id} className="px-4 py-3 flex gap-2.5">
                  <div className="shrink-0 mt-0.5">
                    {r.is_professor ? (
                      <span className="w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center text-white text-[10px] font-bold">P</span>
                    ) : (
                      <span className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center text-gray-500 text-[10px]">A</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className={`text-xs font-semibold ${r.is_professor ? 'text-purple-700' : 'text-gray-500'}`}>
                        {r.is_professor ? '👩‍🏫 Professor' : 'Anonymous'}
                      </span>
                      <span className="text-[10px] text-gray-300">{timeAgo(r.created_at)}</span>
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed">{r.reply_text}</p>
                  </div>
                </div>
              ))}

              {replies.length === 0 && !replying && (
                <p className="text-xs text-gray-400 text-center py-4">No replies yet</p>
              )}
            </div>
          )}

          {/* Reply input */}
          {replying && (
            <form onSubmit={handleReply} className="px-4 pb-4 pt-2 border-t border-gray-100">
              <textarea
                ref={textareaRef}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:border-purple-300 min-h-[72px] bg-white placeholder:text-gray-300"
                placeholder="Write a reply..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
              />
              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => { setReplying(false); setReplyText('') }}
                  className="flex-1 py-2 text-xs text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReply || !replyText.trim()}
                  className="flex-1 py-2 text-xs font-semibold bg-purple-600 text-white rounded-xl hover:bg-purple-700 disabled:opacity-40 transition"
                >
                  {submittingReply ? '...' : 'Post reply'}
                </button>
              </div>
            </form>
          )}
          {!replying && showReplies && (
            <div className="px-4 pb-3">
              <button
                onClick={handleReplyClick}
                className="w-full text-xs text-gray-400 border border-dashed border-gray-200 rounded-xl py-2 hover:text-purple-500 hover:border-purple-300 transition"
              >
                + Write a reply
              </button>
            </div>
          )}
        </div>
      )}
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-white">
        <div className="w-6 h-6 border-4 border-purple-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-indigo-50 pb-20">
      {/* Sticky header */}
      <div className="bg-white border-b sticky top-0 z-10 px-4 py-4 text-center shadow-sm">
        <div className="inline-flex items-center gap-1.5 bg-purple-100 text-purple-700 text-xs font-semibold px-3 py-1 rounded-full mb-1">
          💬 Live Q&A
        </div>
        <h1 className="text-sm font-bold text-gray-900 mt-0.5 leading-tight truncate max-w-xs mx-auto">{lectureTitle}</h1>
        <p className="text-xs text-gray-400 mt-0.5">Lecture {num} · Ask anything, anonymously</p>
      </div>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-4">
        {/* Ask input */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border p-4">
          {justPosted && (
            <div className="text-sm text-green-600 bg-green-50 rounded-lg px-3 py-2 mb-3 flex items-center gap-2">
              <span>✓</span> Question posted!
            </div>
          )}
          <textarea
            className="w-full text-sm border-0 focus:outline-none resize-none placeholder:text-gray-300 min-h-[72px]"
            placeholder="What's on your mind? Ask away..."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="flex items-center justify-between pt-2 border-t mt-2">
            <span className="text-xs text-gray-300">You're posting anonymously</span>
            <button
              type="submit"
              disabled={submitting || !text.trim()}
              className="px-4 py-1.5 bg-purple-600 text-white rounded-xl text-sm font-semibold hover:bg-purple-700 disabled:opacity-40 transition"
            >
              {submitting ? '...' : 'Ask'}
            </button>
          </div>
        </form>

        {/* Stats */}
        {questions.length > 0 && (
          <div className="flex items-center gap-2 px-1">
            <span className="text-xs font-semibold text-gray-500">
              {questions.length} question{questions.length !== 1 ? 's' : ''}
            </span>
            <span className="text-gray-200">·</span>
            <span className="text-xs text-gray-400">sorted by votes</span>
          </div>
        )}

        {/* Questions */}
        {questions.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">🤔</p>
            <p className="text-gray-400 text-sm">No questions yet. Be the first!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {questions.map((q) => (
              <QuestionCard
                key={q.id}
                q={q}
                hasUpvoted={upvoted.has(q.id)}
                onUpvote={handleUpvote}
                autoOpenReplies={q.id === newQuestionId}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
