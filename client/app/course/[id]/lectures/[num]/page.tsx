'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { PlayCircle, FileText, Share2, ChevronLeft, ChevronRight, Check, LayoutDashboard, RefreshCw, Download, Presentation, Clock, Eye } from 'lucide-react'
import AppHeader from '@/components/AppHeader'
import type { Lecture, LectureResource, PresentationGuide } from '@/lib/api'
import { listLectures, generateQuiz, prepareNextLecture, generateResources, getResources, shareResourceToForum, generatePresentationGuide, getPresentationGuide } from '@/lib/api'

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
  const [guide, setGuide] = useState<PresentationGuide | null>(null)
  const [generatingGuide, setGeneratingGuide] = useState(false)
  const [guideTab, setGuideTab] = useState<'slides' | 'flow'>('slides')
  const [showQR, setShowQR] = useState<Set<string>>(new Set())

  useEffect(() => {
    listLectures(id)
      .then(async (lectures) => {
        const lec = lectures.find((l) => l.lecture_number === parseInt(num))
        if (!lec) return
        setLecture(lec)
        const res = await getResources(lec.id).catch(() => [])
        setResources(res)
        const existingGuide = await getPresentationGuide(lec.id).catch(() => null)
        if (existingGuide) setGuide(existingGuide)
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

  function downloadNotesTxt() {
    if (!lecture) return
    const outcomes = lecture.content.learning_outcomes.map((o) => `  • ${o}`).join('\n')
    const concepts = lecture.content.key_concepts.join(', ')
    const content = [
      `Lecture ${lecture.lecture_number}: ${lecture.title}`,
      '='.repeat(60),
      '',
      'LEARNING OUTCOMES',
      outcomes,
      '',
      'KEY CONCEPTS',
      `  ${concepts}`,
      '',
      'CONTENT',
      lecture.content.main_content,
    ].join('\n')
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Lecture_${lecture.lecture_number}_${lecture.title.replace(/\s+/g, '_')}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  function downloadNotesPdf() {
    if (!lecture) return
    const win = window.open('', '_blank')
    if (!win) return
    const escHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const outcomes = lecture.content.learning_outcomes.map((o) => `<li>${escHtml(o)}</li>`).join('')
    const concepts = lecture.content.key_concepts.map((c) => `<span class="tag">${escHtml(c)}</span>`).join(' ')
    const bodyHtml = lecture.content.main_content
      .split('\n')
      .map((line) => {
        const t = line.trim()
        if (!t) return '<br/>'
        if (/^\d+\.\s/.test(t)) return `<h3>${escHtml(t)}</h3>`
        if (t.startsWith('- ')) return `<p class="bullet">· ${escHtml(t.slice(2))}</p>`
        return `<p>${escHtml(t)}</p>`
      })
      .join('')
    win.document.write(`<!DOCTYPE html><html><head>
      <title>Lecture ${lecture.lecture_number}: ${lecture.title}</title>
      <style>
        body{font-family:Georgia,serif;max-width:700px;margin:56px auto;color:#111;line-height:1.75;font-size:14px}
        h1{font-size:22px;font-weight:700;margin:0 0 4px}
        .meta{font-size:11px;color:#777;margin-bottom:32px}
        h2{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#555;margin:28px 0 8px;font-weight:600}
        h3{font-size:14px;font-weight:700;margin:20px 0 4px}
        ul{margin:0 0 0 16px;padding:0}li{margin-bottom:4px}
        p{margin:3px 0}.bullet{margin-left:12px}
        .tag{display:inline-block;background:#f0f0f0;border-radius:99px;padding:2px 10px;font-size:12px;margin:2px}
        @media print{body{margin:32px}}
      </style>
    </head><body>
      <h1>Lecture ${lecture.lecture_number}: ${escHtml(lecture.title)}</h1>
      <p class="meta">Generated by TeachMap</p>
      <h2>Learning Outcomes</h2><ul>${outcomes}</ul>
      <h2>Key Concepts</h2><p>${concepts}</p>
      <h2>Content</h2>${bodyHtml}
    </body></html>`)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print() }, 400)
  }

  function renderContent(text: string) {
    const lines = text.split('\n')
    return lines.map((line, i) => {
      const trimmed = line.trim()
      if (!trimmed) return <div key={i} className="h-2" />

      const lower = trimmed.toLowerCase()
      if (lower.startsWith('class participation prompt:') || lower.startsWith('class participation prompt ')) {
        const content = trimmed.slice(trimmed.indexOf(':') + 1).trim().replace(/^"(.*)"$/, '$1')
        return (
          <div key={i} className="my-3 bg-surface-container rounded-lg px-4 py-3 border-l-2 border-outline-variant">
            <p className="font-label text-[10px] tracking-widest text-on-surface-variant uppercase mb-1">Discussion Prompt</p>
            <p className="text-sm text-on-surface italic leading-relaxed">{content}</p>
          </div>
        )
      }
      if (lower.startsWith('class activity:') || lower.startsWith('class activity ')) {
        const content = trimmed.slice(trimmed.indexOf(':') + 1).trim().replace(/^"(.*)"$/, '$1')
        return (
          <div key={i} className="my-3 bg-surface-container-low rounded-lg px-4 py-3 border-l-2 border-outline">
            <p className="font-label text-[10px] tracking-widest text-on-surface-variant uppercase mb-1">Class Activity</p>
            <p className="text-sm text-on-surface leading-relaxed">{content}</p>
          </div>
        )
      }
      if (/^\d+\.\s/.test(trimmed)) {
        return (
          <p key={i} className="font-headline font-[600] text-sm text-on-surface mt-5 mb-1.5 first:mt-0">
            {trimmed}
          </p>
        )
      }
      if (trimmed.startsWith('- ')) {
        return (
          <div key={i} className="flex gap-2 text-sm text-on-surface leading-relaxed ml-1 my-0.5">
            <span className="text-outline shrink-0 mt-0.5">·</span>
            <span>{trimmed.slice(2)}</span>
          </div>
        )
      }
      return <p key={i} className="text-sm text-on-surface leading-relaxed my-0.5">{trimmed}</p>
    })
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

  async function handleGenerateGuide() {
    if (!lecture) return
    setGeneratingGuide(true)
    try {
      const g = await generatePresentationGuide(lecture.id)
      setGuide(g)
    } finally {
      setGeneratingGuide(false)
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
              <div className="flex items-center justify-between mb-3">
                <p className="font-label text-xs tracking-widest text-on-surface-variant uppercase">Lecture Content</p>
                <div className="flex items-center gap-1.5">
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    onClick={downloadNotesTxt}
                    className="flex items-center gap-1 font-label text-[10px] text-outline hover:text-on-surface-variant border border-outline-variant rounded-full px-2.5 py-1 transition-colors"
                  >
                    <Download className="w-2.5 h-2.5" />
                    .txt
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    onClick={downloadNotesPdf}
                    className="flex items-center gap-1 font-label text-[10px] text-outline hover:text-on-surface-variant border border-outline-variant rounded-full px-2.5 py-1 transition-colors"
                  >
                    <Download className="w-2.5 h-2.5" />
                    PDF
                  </motion.button>
                </div>
              </div>
              <div className="space-y-0.5">
                {renderContent(lecture.content.main_content)}
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
            {/* Teaching Guide */}
            <div className="bg-surface-container-lowest rounded-lg p-5 shadow-card">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="font-label text-xs tracking-widest text-on-surface-variant uppercase">Teaching Guide</p>
                  <p className="font-label text-xs text-outline mt-0.5">Slide-by-slide plan + class flow</p>
                </div>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleGenerateGuide}
                  disabled={generatingGuide}
                  className="flex items-center gap-1.5 font-label text-xs text-on-surface-variant hover:text-on-surface border border-outline-variant rounded-full px-3 py-1.5 transition-colors disabled:opacity-40 shrink-0"
                >
                  <RefreshCw className={`w-3 h-3 ${generatingGuide ? 'animate-spin' : ''}`} />
                  {guide ? 'Regenerate' : 'Generate Guide'}
                </motion.button>
              </div>

              {generatingGuide && (
                <div className="flex items-center gap-2 py-6 font-label text-xs text-on-surface-variant">
                  <div className="w-3.5 h-3.5 border-2 border-on-surface-variant border-t-transparent rounded-full animate-spin" />
                  Building your teaching guide…
                </div>
              )}

              {!guide && !generatingGuide && (
                <div className="text-center py-6">
                  <Presentation className="w-7 h-7 text-outline mx-auto mb-2" />
                  <p className="font-label text-sm text-on-surface-variant">Generate a slide-by-slide breakdown with class flow and quiz timing</p>
                </div>
              )}

              {guide && !generatingGuide && (
                <>
                  {/* Tab switcher */}
                  <div className="flex gap-1 mb-4 bg-surface-container rounded-full p-0.5 w-fit">
                    {(['slides', 'flow'] as const).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setGuideTab(tab)}
                        className={`font-label text-xs px-3 py-1 rounded-full transition-colors capitalize ${
                          guideTab === tab
                            ? 'bg-surface-container-lowest text-on-surface shadow-sm'
                            : 'text-on-surface-variant hover:text-on-surface'
                        }`}
                      >
                        {tab === 'slides' ? 'Slides' : 'Class Flow'}
                      </button>
                    ))}
                  </div>

                  {guideTab === 'slides' && (
                    <div className="space-y-3">
                      {guide.slides.map((slide) => (
                        <div key={slide.number} className="bg-surface-container-low rounded-xl p-4">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-label text-[10px] font-bold text-outline shrink-0">
                                {String(slide.number).padStart(2, '0')}
                              </span>
                              <p className="font-headline font-[600] text-sm text-on-surface truncate">{slide.title}</p>
                            </div>
                            <span className="flex items-center gap-1 font-label text-[10px] text-outline shrink-0">
                              <Clock className="w-2.5 h-2.5" />
                              {slide.duration_minutes}m
                            </span>
                          </div>
                          <ul className="space-y-1 mb-3">
                            {slide.content_points.map((pt, i) => (
                              <li key={i} className="flex gap-2 text-xs text-on-surface-variant leading-relaxed">
                                <span className="text-outline shrink-0 mt-0.5">·</span>
                                <span>{pt}</span>
                              </li>
                            ))}
                          </ul>
                          <div className="flex items-start gap-2 pt-2 border-t border-surface-container">
                            <Eye className="w-3 h-3 text-outline shrink-0 mt-0.5" />
                            <p className="font-label text-[11px] text-outline italic">{slide.suggested_visual}</p>
                          </div>
                          {slide.teaching_note && (
                            <div className="mt-2 bg-surface-container rounded-lg px-3 py-2">
                              <p className="font-label text-[10px] tracking-widest text-on-surface-variant uppercase mb-0.5">Professor note</p>
                              <p className="font-label text-xs text-on-surface">{slide.teaching_note}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {guideTab === 'flow' && (
                    <div className="space-y-2">
                      {guide.class_flow.map((phase, i) => (
                        <div key={i} className="flex gap-3">
                          <div className="flex flex-col items-center">
                            <div className="w-2 h-2 rounded-full bg-outline-variant mt-1.5 shrink-0" />
                            {i < guide.class_flow.length - 1 && (
                              <div className="w-px flex-1 bg-outline-variant/40 mt-1" />
                            )}
                          </div>
                          <div className="pb-4 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <p className="font-headline font-[600] text-sm text-on-surface">{phase.phase}</p>
                              <span className="font-label text-[10px] text-outline">{phase.duration}</span>
                            </div>
                            <p className="font-label text-xs text-on-surface-variant leading-relaxed">{phase.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Professor Notes */}
            <div className="bg-surface-container-lowest rounded-lg p-5 shadow-card">
              <div className="flex items-center justify-between mb-3">
                <p className="font-label text-xs tracking-widest text-on-surface-variant uppercase">My Notes</p>
                {notesSaved && notes.trim() && (
                  <span className="font-label text-[10px] text-outline">Saved</span>
                )}
              </div>
              <textarea
                className="w-full bg-surface-container-low rounded-lg px-4 py-3 text-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-1 focus:ring-outline transition resize-none min-h-[120px]"
                placeholder="Add private notes — talking points, things to emphasise, reminders…"
                value={notes}
                onChange={(e) => handleNoteChange(e.target.value)}
              />
              <p className="font-label text-[10px] text-outline mt-2">Only visible to you · saved locally · included in ZIP export</p>
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
              <div className="space-y-2">
                {shareLinks.map(({ type, label }) => {
                  const shareBase = process.env.NEXT_PUBLIC_SHARE_BASE_URL ||
                    (typeof window !== 'undefined' ? window.location.origin : '')
                  const url = `${shareBase}/s/${id}/lecture/${num}/${type}`
                  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(url)}`
                  const isQROpen = showQR.has(type)
                  return (
                    <div key={type} className="bg-surface-container-low rounded-lg px-3 py-2.5">
                      <div className="flex items-center justify-between">
                        <span className="font-label text-xs font-semibold text-on-surface">{label}</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setShowQR(prev => {
                              const next = new Set(prev)
                              next.has(type) ? next.delete(type) : next.add(type)
                              return next
                            })}
                            className={`font-label text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                              isQROpen
                                ? 'border-on-surface bg-on-surface text-surface-container-lowest'
                                : 'border-outline-variant text-on-surface-variant hover:border-on-surface hover:text-on-surface'
                            }`}
                          >
                            QR
                          </button>
                          <button
                            onClick={() => copyLink(type)}
                            className="font-label text-[10px] text-on-surface-variant hover:text-on-surface transition-colors"
                          >
                            {copied === type ? '✓' : 'Copy'}
                          </button>
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-label text-[10px] text-outline hover:text-on-surface-variant transition-colors"
                          >
                            ↗
                          </a>
                        </div>
                      </div>
                      {isQROpen && (
                        <div className="mt-3 flex flex-col items-center gap-2">
                          <img
                            src={qrSrc}
                            alt={`QR code for ${label}`}
                            className="w-36 h-36 rounded-lg"
                          />
                          <p className="font-label text-[10px] text-outline text-center break-all leading-relaxed">
                            {url}
                          </p>
                        </div>
                      )}
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
