'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
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

  return (
    <div className={`border rounded-xl p-3 flex gap-3 group hover:border-indigo-200 hover:bg-indigo-50 transition ${isVideo ? 'border-red-100 bg-red-50/30' : 'border-blue-100 bg-blue-50/30'}`}>
      <span className={`text-xl shrink-0 mt-0.5`}>{isVideo ? '▶️' : '📄'}</span>
      <div className="flex-1 min-w-0">
        <a
          href={resource.url || '#'}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-gray-800 hover:text-indigo-700 hover:underline line-clamp-1 block"
        >
          {resource.title}
        </a>
        {resource.description && (
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{resource.description}</p>
        )}
        {resource.url && (
          <p className="text-xs text-gray-400 mt-0.5 truncate">{new URL(resource.url).hostname}</p>
        )}
      </div>
      <div className="flex flex-col items-end gap-1.5 shrink-0">
        <a
          href={resource.url || '#'}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-indigo-500 hover:text-indigo-700 font-medium"
        >
          Open ↗
        </a>
        <button
          onClick={handleShare}
          disabled={shared || sharing}
          className={`text-xs font-medium px-2 py-0.5 rounded-full transition ${
            shared
              ? 'bg-green-100 text-green-600 cursor-default'
              : 'bg-purple-100 text-purple-600 hover:bg-purple-200 disabled:opacity-50'
          }`}
        >
          {shared ? '✓ Shared' : sharing ? '...' : 'Share to Forum'}
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

  useEffect(() => {
    listLectures(id)
      .then(async (lectures) => {
        const lec = lectures.find((l) => l.lecture_number === parseInt(num))
        if (!lec) return
        setLecture(lec)
        const res = await getResources(lec.id).catch(() => [])
        setResources(res)
      })
      .finally(() => setLoading(false))
  }, [id, num])

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

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading...</div>
  if (!lecture) return <div className="min-h-screen flex items-center justify-center text-gray-400">Lecture not found.</div>

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <button onClick={() => router.push(`/course/${id}/lectures`)} className="text-gray-400 hover:text-gray-600 text-sm">
          ← Lectures
        </button>
        <div className="flex-1">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Lecture {lecture.lecture_number}</p>
          <h1 className="text-lg font-semibold text-gray-900">{lecture.title}</h1>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8 grid grid-cols-3 gap-6">
        {/* Main content */}
        <div className="col-span-2 space-y-5">
          {/* Revision */}
          {lecture.revision_content && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
              <h2 className="font-semibold text-amber-800 mb-3 text-sm uppercase tracking-wide">
                Revision — Lecture {lecture.revision_content.from_lecture}
              </h2>
              <ul className="space-y-1.5">
                {lecture.revision_content.recap_points.map((p, i) => (
                  <li key={i} className="text-sm text-amber-700 flex gap-2"><span>•</span><span>{p}</span></li>
                ))}
              </ul>
              {lecture.revision_content.weak_areas.length > 0 && (
                <div className="mt-3 pt-3 border-t border-amber-200">
                  <p className="text-xs font-medium text-amber-600 mb-1">Areas to reinforce:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {lecture.revision_content.weak_areas.map((a, i) => (
                      <span key={i} className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{a}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Learning outcomes */}
          <div className="bg-white rounded-xl border p-5">
            <h2 className="font-semibold text-gray-800 mb-3">Learning Outcomes</h2>
            <ul className="space-y-2">
              {lecture.content.learning_outcomes.map((o, i) => (
                <li key={i} className="text-sm text-gray-700 flex gap-2">
                  <span className="text-indigo-400 shrink-0">✓</span><span>{o}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Key concepts */}
          <div className="bg-white rounded-xl border p-5">
            <h2 className="font-semibold text-gray-800 mb-3">Key Concepts</h2>
            <div className="flex flex-wrap gap-2">
              {lecture.content.key_concepts.map((c, i) => (
                <span key={i} className="text-sm bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full border border-indigo-100">
                  {c}
                </span>
              ))}
            </div>
          </div>

          {/* Main content */}
          <div className="bg-white rounded-xl border p-5">
            <h2 className="font-semibold text-gray-800 mb-3">Lecture Content</h2>
            <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
              {lecture.content.main_content}
            </div>
          </div>

          {/* Resources */}
          <div className="bg-white rounded-xl border p-5">
            <div className="flex items-center justify-between mb-1">
              <div>
                <h2 className="font-semibold text-gray-800">Pre-Lecture Resources</h2>
                <p className="text-xs text-gray-400 mt-0.5">YouTube videos &amp; articles for your prep — share to forum for students</p>
              </div>
              <button
                onClick={handleGenerateResources}
                disabled={generatingResources}
                className="text-sm px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 shrink-0"
              >
                {generatingResources ? 'Finding...' : resources.length ? 'Refresh' : 'Find Resources'}
              </button>
            </div>

            {generatingResources && (
              <div className="flex items-center gap-2 py-6 text-sm text-gray-400">
                <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                Searching YouTube &amp; the web...
              </div>
            )}

            {resources.length === 0 && !generatingResources && (
              <p className="text-sm text-gray-400 text-center py-6">
                No resources yet — click "Find Resources" to pull relevant videos &amp; articles.
              </p>
            )}

            {resources.length > 0 && !generatingResources && (
              <div className="mt-4 space-y-2">
                {/* Videos */}
                {resources.filter(r => r.resource_type === 'video').length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                      <span>▶</span> YouTube Videos
                    </p>
                    <div className="space-y-2">
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
                {/* Articles */}
                {resources.filter(r => r.resource_type === 'reading').length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs font-semibold text-blue-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                      <span>📄</span> Articles &amp; Blogs
                    </p>
                    <div className="space-y-2">
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
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Share links */}
          <div className="bg-white rounded-xl border p-4">
            <h3 className="font-semibold text-gray-800 mb-3 text-sm">Share with students</h3>
            <div className="space-y-2">
              {([
                { type: 'forum',    emoji: '💬', label: 'Live Q&A Forum',    color: 'bg-purple-50 border-purple-200 hover:border-purple-400' },
                { type: 'quiz',     emoji: '📝', label: 'Quiz',              color: 'bg-blue-50 border-blue-200 hover:border-blue-400' },
                { type: 'feedback', emoji: '⭐', label: 'Class Feedback',    color: 'bg-amber-50 border-amber-200 hover:border-amber-400' },
              ] as const).map(({ type, emoji, label, color }) => {
                const url = typeof window !== 'undefined'
                  ? `${window.location.origin}/s/${id}/lecture/${num}/${type}`
                  : `/s/${id}/lecture/${num}/${type}`
                return (
                  <div key={type} className={`border rounded-xl p-3 ${color} transition`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">{emoji} {label}</span>
                      <button
                        onClick={() => copyLink(type as 'forum' | 'quiz' | 'feedback')}
                        className="text-xs text-gray-400 hover:text-indigo-600 transition"
                        title="Copy link"
                      >
                        {copied === type ? '✓ Copied' : 'Copy'}
                      </button>
                    </div>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-xs text-indigo-500 hover:text-indigo-700 hover:underline truncate"
                    >
                      Open ↗
                    </a>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="bg-white rounded-xl border p-4 space-y-2">
            <h3 className="font-semibold text-gray-800 mb-3 text-sm">Actions</h3>
            <button
              onClick={handleGenerateQuiz}
              disabled={generatingQuiz || quizReady}
              className="w-full py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
              {quizReady ? 'Quiz ready ✓' : generatingQuiz ? 'Generating...' : 'Generate Quiz'}
            </button>
            <button
              onClick={handlePrepareNext}
              disabled={preparingNext}
              className="w-full py-2 border rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
            >
              {preparingNext ? 'Preparing...' : 'Prepare Next Lecture'}
            </button>
            <button
              onClick={() => router.push(`/course/${id}/dashboard`)}
              className="w-full py-2 border rounded-lg text-sm font-medium hover:bg-gray-50"
            >
              View Dashboard
            </button>
          </div>

          {/* Navigation */}
          <div className="flex gap-2">
            {parseInt(num) > 1 && (
              <button
                onClick={() => router.push(`/course/${id}/lectures/${parseInt(num) - 1}`)}
                className="flex-1 py-2 border rounded-lg text-sm hover:bg-gray-50"
              >
                ← Prev
              </button>
            )}
            <button
              onClick={() => router.push(`/course/${id}/lectures/${parseInt(num) + 1}`)}
              className="flex-1 py-2 border rounded-lg text-sm hover:bg-gray-50"
            >
              Next →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
