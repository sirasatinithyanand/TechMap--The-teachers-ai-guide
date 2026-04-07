'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import type { Chapter, Course } from '@/lib/api'
import {
  getCourse,
  generateBaseline,
  updateCurriculum,
  finalizeCurriculum,
  generateLectures,
  uploadFile,
  blendCurriculum,
  saveInspiration,
} from '@/lib/api'

const MapboxMap = dynamic(() => import('@/components/MapboxMap'), { ssr: false })

type Phase = 'loading' | 'ready' | 'blending' | 'finalizing' | 'generating'

export default function CurriculumPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [course, setCourse] = useState<Course | null>(null)
  const [baselineChapters, setBaselineChapters] = useState<Chapter[]>([])   // university reference (read-only)
  const [chapters, setChapters] = useState<Chapter[]>([])                    // professor's editable version
  const [phase, setPhase] = useState<Phase>('loading')
  const [generatingProgress, setGeneratingProgress] = useState('')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  const [showBaseline, setShowBaseline] = useState(false)

  useEffect(() => {
    getCourse(id)
      .then((c) => {
        setCourse(c)
        return generateBaseline(id)
      })
      .then((curriculum) => {
        const loaded = curriculum.content.chapters
        setBaselineChapters(loaded)
        setChapters(JSON.parse(JSON.stringify(loaded))) // editable copy
        setPhase('ready')
      })
      .catch(() => {
        setError('Failed to load baseline curriculum.')
        setPhase('ready')
      })
  }, [id])

  function updateChapter(idx: number, field: keyof Chapter, value: string | string[]) {
    setChapters((prev) => prev.map((ch, i) => (i === idx ? { ...ch, [field]: value } : ch)))
  }

  function addChapter() {
    setChapters((prev) => [
      ...prev,
      { number: prev.length + 1, title: 'New Chapter', description: '', learning_outcomes: [], topics: [] },
    ])
  }

  function removeChapter(idx: number) {
    setChapters((prev) =>
      prev.filter((_, i) => i !== idx).map((ch, i) => ({ ...ch, number: i + 1 }))
    )
  }

  function resetToBaseline() {
    setChapters(JSON.parse(JSON.stringify(baselineChapters)))
    setEditingIdx(null)
  }

  async function handleSave() {
    setSaving(true)
    try {
      await updateCurriculum(id, chapters)
    } catch {
      setError('Failed to save.')
    } finally {
      setSaving(false)
    }
  }

  async function handleFinalize() {
    setError('')
    try {
      setPhase('finalizing')
      await updateCurriculum(id, chapters)
      await finalizeCurriculum(id)

      setPhase('generating')
      setGeneratingProgress(`Generating ${chapters.length} lectures...`)
      await generateLectures(id)

      router.push(`/course/${id}/lectures`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
      setPhase('ready')
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError('')
    try {
      const result = await uploadFile(id, file)
      if (result.extracted_chapters.length) {
        setChapters((prev) => {
          const merged = [...prev]
          result.extracted_chapters.forEach((ch) => {
            if (!merged.find((c) => c.title.toLowerCase() === ch.title.toLowerCase())) {
              merged.push({ ...ch, number: merged.length + 1 })
            }
          })
          return merged
        })
      }
    } catch {
      setError('File upload failed.')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  async function handleInspire(selectedChapters: Chapter[], inspiredUniversity?: string) {
    if (!course) return
    setError('')
    setPhase('blending')
    try {
      const result = await blendCurriculum(id, inspiredUniversity || 'Inspiration University', selectedChapters)
      if (result.chapters?.length > 0) {
        setChapters(result.chapters)
      }
      // Save inspiration record in background
      saveInspiration(id, inspiredUniversity || '', '', selectedChapters).catch(() => {})
    } catch {
      setError('Blend failed — applying chapters manually instead.')
      // Fallback: simple topic merge
      setChapters((prev) => {
        const updated = prev.map((ch) => ({ ...ch, topics: [...ch.topics] }))
        const total = updated.length
        selectedChapters.forEach((inspired, idx) => {
          const targetIdx = Math.min(Math.round((idx / selectedChapters.length) * total), total - 1)
          const target = updated[targetIdx]
          updated[targetIdx] = {
            ...target,
            topics: Array.from(new Set([...target.topics, ...inspired.topics])),
            description: target.description || inspired.description || '',
          }
        })
        return updated
      })
    } finally {
      setPhase('ready')
    }
  }

  // Full-screen loading/generating overlay
  if (phase === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Fetching university curriculum...</p>
        </div>
      </div>
    )
  }

  if (phase === 'blending' || phase === 'finalizing' || phase === 'generating') {
    const messages = {
      blending: { title: 'Blending curricula...', sub: 'AI is merging both universities into your personalized curriculum.' },
      finalizing: { title: 'Locking curriculum...', sub: 'Saving your personalised curriculum.' },
      generating: { title: 'Generating lectures', sub: `${generatingProgress} This takes about 30–60 seconds.` },
    }
    const { title, sub } = messages[phase]
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-sm">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-800 mb-1">{title}</h2>
          <p className="text-sm text-gray-400">{sub}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">
            {course?.course_name}
            {course?.course_code && (
              <span className="ml-2 text-gray-400 font-normal text-sm">({course.course_code})</span>
            )}
          </h1>
          <p className="text-sm text-gray-500">
            {course?.university_name} · {course?.grade_level || 'Undergraduate'}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Draft'}
          </button>
          <button
            onClick={handleFinalize}
            disabled={chapters.length === 0}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
          >
            Finalise & Generate Lectures
          </button>
        </div>
      </header>

      {error && (
        <div className="bg-red-50 border-b border-red-200 px-6 py-2 text-sm text-red-600">{error}</div>
      )}

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left: Curriculum editor */}
        <div className="w-2/5 border-r bg-white flex flex-col overflow-hidden">

          {/* University baseline toggle */}
          <div className="border-b">
            <button
              onClick={() => setShowBaseline(!showBaseline)}
              className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50 text-sm transition"
            >
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />
                <span className="font-medium text-gray-700">
                  {course?.university_name} Official Curriculum
                </span>
                <span className="text-xs text-gray-400">({baselineChapters.length} chapters)</span>
              </div>
              <span className="text-gray-400 text-xs">{showBaseline ? '▲ Hide' : '▼ View'}</span>
            </button>

            {showBaseline && (
              <div className="bg-blue-50 px-5 pb-4 max-h-56 overflow-y-auto border-t border-blue-100">
                <p className="text-xs text-blue-500 py-2">
                  Read-only reference — this is what {course?.university_name} teaches.
                </p>
                <ol className="space-y-2">
                  {baselineChapters.map((ch) => (
                    <li key={ch.number} className="text-sm">
                      <span className="font-medium text-blue-700">{ch.number}. {ch.title}</span>
                      {ch.topics.length > 0 && (
                        <p className="text-xs text-blue-400 mt-0.5">{ch.topics.join(' · ')}</p>
                      )}
                    </li>
                  ))}
                </ol>
                <button
                  onClick={resetToBaseline}
                  className="mt-3 text-xs text-blue-600 hover:underline"
                >
                  Reset my curriculum to this baseline
                </button>
              </div>
            )}
          </div>

          {/* Editable curriculum header */}
          <div className="px-5 py-3 border-b flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-800 text-sm">Your Personalised Curriculum</h2>
              <p className="text-xs text-gray-400 mt-0.5">Edit chapters, add inspiration from the map, or upload files</p>
            </div>
            <label className="cursor-pointer text-sm text-indigo-600 hover:underline flex items-center gap-1 shrink-0">
              {uploading ? 'Uploading...' : '+ Upload'}
              <input
                type="file"
                className="hidden"
                accept=".pdf,.txt,.docx"
                onChange={handleFileUpload}
                disabled={uploading}
              />
            </label>
          </div>

          {/* Editable chapters */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {chapters.map((ch, idx) => (
              <div
                key={idx}
                className="border rounded-lg p-3 bg-gray-50 hover:border-indigo-300 transition cursor-pointer"
                onClick={() => setEditingIdx(editingIdx === idx ? null : idx)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex gap-2 flex-1 min-w-0">
                    <span className="text-indigo-500 font-medium text-sm shrink-0">{ch.number}.</span>
                    {editingIdx === idx ? (
                      <input
                        className="flex-1 text-sm font-medium border-b border-indigo-400 bg-transparent focus:outline-none"
                        value={ch.title}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => updateChapter(idx, 'title', e.target.value)}
                      />
                    ) : (
                      <span className="text-sm font-medium text-gray-800 truncate">{ch.title}</span>
                    )}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeChapter(idx) }}
                    className="text-gray-300 hover:text-red-400 text-xs shrink-0"
                  >
                    ✕
                  </button>
                </div>

                {editingIdx === idx && (
                  <div className="mt-2 space-y-2" onClick={(e) => e.stopPropagation()}>
                    <textarea
                      className="w-full text-xs border rounded px-2 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-400"
                      rows={2}
                      placeholder="Description..."
                      value={ch.description || ''}
                      onChange={(e) => updateChapter(idx, 'description', e.target.value)}
                    />
                    <input
                      className="w-full text-xs border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                      placeholder="Topics (comma separated)"
                      value={ch.topics.join(', ')}
                      onChange={(e) =>
                        updateChapter(idx, 'topics', e.target.value.split(',').map((t) => t.trim()).filter(Boolean))
                      }
                    />
                    <input
                      className="w-full text-xs border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                      placeholder="Learning outcomes (comma separated)"
                      value={ch.learning_outcomes.join(', ')}
                      onChange={(e) =>
                        updateChapter(idx, 'learning_outcomes', e.target.value.split(',').map((t) => t.trim()).filter(Boolean))
                      }
                    />
                  </div>
                )}

                {ch.topics.length > 0 && editingIdx !== idx && (
                  <p className="text-xs text-gray-400 mt-1 truncate">{ch.topics.join(' · ')}</p>
                )}
              </div>
            ))}

            <button
              onClick={addChapter}
              className="w-full py-2 border-2 border-dashed border-gray-200 rounded-lg text-sm text-gray-400 hover:border-indigo-300 hover:text-indigo-500 transition"
            >
              + Add chapter
            </button>
          </div>
        </div>

        {/* Right: Map */}
        <div className="flex-1 flex flex-col">
          {course && (
            <MapboxMap courseId={id} courseName={course.course_name} onInspire={(chapters, uni) => handleInspire(chapters, uni)} />
          )}
        </div>
      </div>
    </div>
  )
}
