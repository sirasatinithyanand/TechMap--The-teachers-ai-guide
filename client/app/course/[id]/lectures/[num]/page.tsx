'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { PlayCircle, FileText, Share2, ChevronLeft, ChevronRight, Check, LayoutDashboard, RefreshCw } from 'lucide-react'
import AppHeader from '@/components/AppHeader'
import type { Lecture, LectureResource } from '@/lib/api'
import { listLectures, generateQuiz, prepareNextLecture, generateResources, getResources, shareResourceToForum } from '@/lib/api'

function ResourceCard({
  resource,
  shared,
  onShare,
}: {
  resource: LectureResource
  shared: boolean
  onShare: () => Promise<void>
}) {
  const [sharing, setSharing] = useState(false)
  const isVideo = resource.resource_type === 'video'

  async function handleShare(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setSharing(true)
    try { await onShare() } finally { setSharing(false) }
  }

  let hostname = ''
  try { hostname = resource.url ? new URL(resource.url).hostname : '' } catch {}

  return (
    <div className="bg-surface-container-low rounded-lg px-4 py-3 flex gap-3 group hover:bg-surface-container transition-colors">
      <div className="shrink-0 mt-0.5">
        {isVideo
          ? <PlayCircle className="w-4 h-4 text-on-surface-variant" />
          : <FileText className="w-4 h-4 text-on-surface-variant" />
        }
      </div>
      <div className="flex-1 min-w-0">
        <a
          href={resource.url || '#'}
          target="_blank"
          rel="noopener noreferrer"
          className="font-headline font-[500] text-sm text-on-surface hover:underline line-clamp-1 block"
        >
          {resource.title}
        </a>
        {resource.description && (
          <p className="font-label text-xs text-on-surface-variant mt-0.5 line-clamp-2">{resource.description}</p>
        )}
        {hostname && (
          <p className="font-label text-xs text-outline mt-0.5 truncate">{hostname}</p>
        )}
      </div>
      <div className="flex flex-col items-end gap-1.5 shrink-0">
        <a
          href={resource.url || '#'}
          target="_blank"
          rel="noopener noreferrer"
          className="font-label text-xs text-on-surface-variant hover:text-on-surface transition-colors"
        >
          Open ↗
        </a>
        <button
          onClick={handleShare}
          disabled={shared || sharing}
          className={`font-label text-[10px] tracking-wide uppercase px-2 py-0.5 rounded-full transition-colors ${
            shared
              ? 'bg-surface-container-highest text-on-surface-variant cursor-default'
              : 'bg-on-surface text-surface-container-lowest hover:bg-primary-container disabled:opacity-50'
          }`}
        >
          {shared ? '✓ Shared' : sharing ? '…' : 'Share'}
        </button>
      </div>
    </div>
  )
}

export default function LectureDetailPage() {
  const { id, num } = useParams<{ id: string; num: string }>()
  const router = useRouter()
  const [lecture, setLecture] = useState<Lecture | null>(null)
  const [resources, setResources] = useState<LectureResource[]>([])
  const [loading, setLoading] = useState(true)
  const [generatingQuiz, setGeneratingQuiz] = useState(false)
  const [preparingNext, setPreparingNext] = useState(false)
  const [generatingResources, setGeneratingResources] = useState(false)
  const [quizReady, setQuizReady] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [sharedToForum, setSharedToForum] = useState<Set<string>>(new Set())
  const [notes, setNotes] = useState('')
  const [notesSaved, setNotesSaved] = useState(false)

  useEffect(() => {
    listLectures(id)
      .then(async (lectures) => {
        const lec = lectures.find((l) => l.lecture_number === parseInt(num))
        if (!lec) return
        setLecture(lec)
        const res = await getResources(lec.id).catch(() => [])
        setResources(res)
        // Load persisted notes for this lecture
        const saved = localStorage.getItem(`tm_notes_${lec.id}`)
        if (saved) setNotes(saved)
      })
      .finally(() => setLoading(false))
  }, [id, num])

  function handleNoteChange(val: string) {
    setNotes(val)
    setNotesSaved(false)
    if (lecture) localStorage.setItem(`tm_notes_${lecture.id}`, val)
    setNotesSaved(true)
  }

  function copyLink(type: 'forum' | 'quiz' | 'feedback') {
    const base = window.location.origin
    navigator.clipboard.writeText(`${base}/s/${id}/lecture/${num}/${type}`)
    setCopied(type)
    setTimeout(() => setCopied(null), 2000)
  }

  async function handleGenerateQuiz() {
    if (!lecture) return
    setGeneratingQuiz(true)
    try {
      await generateQuiz(lecture.id)
      setQuizReady(true)
    } finally {
      setGeneratingQuiz(false)
    }
  }

  async function handleGenerateResources() {
    if (!lecture) return
    setGeneratingResources(true)
    try {
      const res = await generateResources(lecture.id)
      setResources(res)
    } finally {
      setGeneratingResources(false)
    }
  }

  async function handlePrepareNext() {
    if (!lecture) return
    setPreparingNext(true)
    try {
      await prepareNextLecture(lecture.id)
      router.push(`/course/${id}/lectures/${parseInt(num) + 1}`)
    } finally {
      setPreparingNext(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface">
        <div className="h-14 bg-surface-container-lowest border-b border-outline-variant/40" />
        <div className="max-w-5xl mx-auto px-6 py-8 grid grid-cols-3 gap-6">
          <div className="col-span-2 space-y-3">
            {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-32 rounded-lg" />)}
          </div>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-24 rounded-lg" />)}
          </div>
        </div>
      </div>
    )
  }

  if (!lecture) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <p className="font-label text-sm text-on-surface-variant">Lecture not found.</p>
      </div>
    )
  }

  const shareLinks = [
    { type: 'forum' as const, label: 'Live Q&A Forum' },
    { type: 'quiz' as const, label: 'Quiz' },
    { type: 'feedback' as const, label: 'Class Feedback' },
  ]

  return (
    <div className="min-h-screen bg-surface">
      <AppHeader
        backHref={`/course/${id}/lectures`}
        backLabel="All Lectures"
        right={
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => router.push(`/course/${id}/dashboard`)}
            className="flex items-center gap-1.5 font-label text-xs font-semibold bg-primary text-on-primary rounded-full px-4 py-1.5 hover:bg-primary-container transition-colors"
          >
            <LayoutDashboard className="w-3 h-3" />
            Dashboard
          </motion.button>
        }
      />

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="max-w-5xl mx-auto px-6 py-8"
      >
        {/* Title */}
        <div className="mb-6">
          <p className="font-label text-xs tracking-[0.18em] text-on-surface-variant uppercase mb-1">
            Lecture {lecture.lecture_number}
          </p>
          <h1 className="font-headline font-[540] text-2xl tracking-[-0.03em] text-on-surface">
            {lecture.title}
          </h1>
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Main content */}
          <div className="col-span-2 space-y-4">
            {/* Revision */}
            {lecture.revision_content && (
              <div className="bg-surface-container-lowest rounded-lg p-5 shadow-card border-l-2 border-outline">
                <p className="font-label text-xs tracking-widest text-on-surface-variant uppercase mb-3">
                  Revision — Lecture {lecture.revision_content.from_lecture}
                </p>
                <ul className="space-y-1.5">
                  {lecture.revision_content.recap_points.map((p, i) => (
                    <li key={i} className="text-sm text-on-surface flex gap-2">
                      <span className="text-outline shrink-0">·</span><span>{p}</span>
                    </li>
                  ))}
                </ul>
                {lecture.revision_content.weak_areas.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-surface-container">
                    <p className="font-label text-xs text-on-surface-variant uppercase tracking-wide mb-2">Areas to reinforce</p>
                    <div className="flex flex-wrap gap-1.5">
                      {lecture.revision_content.weak_areas.map((a, i) => (
                        <span key={i} className="font-label text-xs bg-surface-container text-on-surface-variant px-2 py-0.5 rounded-full">{a}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Learning outcomes */}
            <div className="bg-surface-container-lowest rounded-lg p-5 shadow-card">
              <p className="font-label text-xs tracking-widest text-on-surface-variant uppercase mb-3">Learning Outcomes</p>
              <ul className="space-y-2">
                {lecture.content.learning_outcomes.map((o, i) => (
                  <li key={i} className="text-sm text-on-surface flex gap-2.5 items-start">
                    <Check className="w-3.5 h-3.5 text-on-surface-variant shrink-0 mt-0.5" />
                    <span>{o}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Key concepts */}
            <div className="bg-surface-container-lowest rounded-lg p-5 shadow-card">
              <p className="font-label text-xs tracking-widest text-on-surface-variant uppercase mb-3">Key Concepts</p>
              <div className="flex flex-wrap gap-2">
                {lecture.content.key_concepts.map((c, i) => (
                  <span key={i} className="font-label text-xs bg-surface-container text-on-surface px-3 py-1 rounded-full">
                    {c}
                  </span>
                ))}
              </div>
            </div>

            {/* Main content */}
            <div className="bg-surface-container-lowest rounded-lg p-5 shadow-card">
              <p className="font-label text-xs tracking-widest text-on-surface-variant uppercase mb-3">Lecture Content</p>
              <div className="text-sm text-on-surface leading-relaxed whitespace-pre-wrap">
                {lecture.content.main_content}
              </div>
            </div>

            {/* Resources */}
            <div className="bg-surface-container-lowest rounded-lg p-5 shadow-card">
              <div className="flex items-start justify-between mb-1">
                <div>
                  <p className="font-label text-xs tracking-widest text-on-surface-variant uppercase">Pre-Lecture Resources</p>
                  <p className="font-label text-xs text-outline mt-0.5">Videos & articles — share to forum for students</p>
                </div>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleGenerateResources}
                  disabled={generatingResources}
                  className="flex items-center gap-1.5 font-label text-xs text-on-surface-variant hover:text-on-surface border border-outline-variant rounded-full px-3 py-1.5 transition-colors disabled:opacity-40 shrink-0"
                >
                  <RefreshCw className={`w-3 h-3 ${generatingResources ? 'animate-spin' : ''}`} />
                  {resources.length ? 'Refresh' : 'Find Resources'}
                </motion.button>
              </div>

              {generatingResources && (
                <div className="flex items-center gap-2 py-6 font-label text-xs text-on-surface-variant">
                  <div className="w-3.5 h-3.5 border-2 border-on-surface-variant border-t-transparent rounded-full animate-spin" />
                  Searching the web…
                </div>
              )}

              {resources.length === 0 && !generatingResources && (
                <p className="font-label text-sm text-on-surface-variant text-center py-6">
                  No resources yet.
                </p>
              )}

              {resources.length > 0 && !generatingResources && (
                <div className="mt-4 space-y-4">
                  {resources.filter(r => r.resource_type === 'video').length > 0 && (
                    <div>
                      <p className="font-label text-[10px] tracking-widest text-on-surface-variant uppercase mb-2 flex items-center gap-1.5">
                        <PlayCircle className="w-3 h-3" /> Videos
                      </p>
                      <div className="space-y-1.5">
                        {resources.filter(r => r.resource_type === 'video').map((r) => (
                          <ResourceCard
                            key={r.id}
                            resource={r}
                            shared={sharedToForum.has(r.id)}
                            onShare={async () => {
                              if (!lecture) return
                              await shareResourceToForum(lecture.id, r)
                              setSharedToForum(prev => new Set(prev).add(r.id))
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  {resources.filter(r => r.resource_type === 'reading').length > 0 && (
                    <div>
                      <p className="font-label text-[10px] tracking-widest text-on-surface-variant uppercase mb-2 flex items-center gap-1.5">
                        <FileText className="w-3 h-3" /> Articles
                      </p>
                      <div className="space-y-1.5">
                        {resources.filter(r => r.resource_type === 'reading').map((r) => (
                          <ResourceCard
                            key={r.id}
                            resource={r}
                            shared={sharedToForum.has(r.id)}
                            onShare={async () => {
                              if (!lecture) return
                              await shareResourceToForum(lecture.id, r)
                              setSharedToForum(prev => new Set(prev).add(r.id))
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            {/* Professor Notes */}
            <div className="bg-surface-container-lowest rounded-lg p-5 shadow-card">
              <div className="flex items-center justify-between mb-3">
                <p className="font-label text-xs tracking-widest text-on-surface-variant uppercase">My Notes</p>
                {notesSaved && (
                  <span className="font-label text-[10px] text-outline">Saved</span>
                )}
              </div>
              <textarea
                className="w-full bg-surface-container-low rounded-lg px-4 py-3 text-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-1 focus:ring-outline transition resize-none min-h-[120px]"
                placeholder="Add private notes for this lecture — talking points, things to emphasise, reminders…"
                value={notes}
                onChange={(e) => handleNoteChange(e.target.value)}
              />
              <p className="font-label text-[10px] text-outline mt-2">Only visible to you · saved locally</p>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-3">
            {/* Share links */}
            <div className="bg-surface-container-lowest rounded-lg p-4 shadow-card">
              <div className="flex items-center gap-1.5 mb-3">
                <Share2 className="w-3.5 h-3.5 text-on-surface-variant" />
                <p className="font-label text-xs tracking-widest text-on-surface-variant uppercase">Share with students</p>
              </div>
              <div className="space-y-1.5">
                {shareLinks.map(({ type, label }) => {
                  const url = typeof window !== 'undefined'
                    ? `${window.location.origin}/s/${id}/lecture/${num}/${type}`
                    : `/s/${id}/lecture/${num}/${type}`
                  return (
                    <div key={type} className="bg-surface-container-low rounded-lg px-3 py-2.5">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-label text-xs text-on-surface">{label}</span>
                        <button
                          onClick={() => copyLink(type)}
                          className="font-label text-[10px] text-on-surface-variant hover:text-on-surface transition-colors"
                        >
                          {copied === type ? '✓ Copied' : 'Copy'}
                        </button>
                      </div>
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-label text-[10px] text-outline hover:text-on-surface-variant truncate block transition-colors"
                      >
                        Open ↗
                      </a>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Actions */}
            <div className="bg-surface-container-lowest rounded-lg p-4 shadow-card space-y-2">
              <p className="font-label text-xs tracking-widest text-on-surface-variant uppercase mb-2">Actions</p>
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={handleGenerateQuiz}
                disabled={generatingQuiz || quizReady}
                className="w-full py-2.5 bg-primary text-on-primary font-label text-xs font-semibold rounded-full hover:bg-primary-container disabled:opacity-40 transition-colors"
              >
                {quizReady ? '✓ Quiz Ready' : generatingQuiz ? 'Generating…' : 'Generate Quiz'}
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={handlePrepareNext}
                disabled={preparingNext}
                className="w-full py-2.5 border border-outline-variant font-label text-xs text-on-surface-variant hover:bg-surface-container rounded-full disabled:opacity-40 transition-colors"
              >
                {preparingNext ? 'Preparing…' : 'Prepare Next Lecture'}
              </motion.button>
            </div>

            {/* Navigation */}
            <div className="flex gap-2">
              {parseInt(num) > 1 && (
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => router.push(`/course/${id}/lectures/${parseInt(num) - 1}`)}
                  className="flex-1 flex items-center justify-center gap-1 py-2 border border-outline-variant font-label text-xs text-on-surface-variant hover:bg-surface-container rounded-full transition-colors"
                >
                  <ChevronLeft className="w-3 h-3" /> Prev
                </motion.button>
              )}
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={() => router.push(`/course/${id}/lectures/${parseInt(num) + 1}`)}
                className="flex-1 flex items-center justify-center gap-1 py-2 border border-outline-variant font-label text-xs text-on-surface-variant hover:bg-surface-container rounded-full transition-colors"
              >
                Next <ChevronRight className="w-3 h-3" />
              </motion.button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
