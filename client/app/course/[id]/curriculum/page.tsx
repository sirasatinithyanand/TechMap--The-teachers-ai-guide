'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, X, Upload, RefreshCw, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react'
import dynamic from 'next/dynamic'
import AppHeader from '@/components/AppHeader'
import LoadingScreen from '@/components/LoadingScreen'
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

const TEACHING_STYLES = [
  { id: 'balanced', label: 'Balanced', desc: 'Equal mix of theory and practical examples' },
  { id: 'examples', label: 'Real-world examples', desc: 'Lead with scenarios, case studies, and applications' },
  { id: 'theory', label: 'Theory-first', desc: 'Deep formal definitions, proofs, and academic rigour' },
  { id: 'interactive', label: 'Interactive', desc: 'Discussion prompts, activities, and participation hooks' },
  { id: 'concise', label: 'Concise & fast-paced', desc: 'Bullet-point style, high density, minimal prose' },
]

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 220, damping: 24 } },
}

export default function CurriculumPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [course, setCourse] = useState<Course | null>(null)
  const [baselineChapters, setBaselineChapters] = useState<Chapter[]>([])
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [phase, setPhase] = useState<Phase>('loading')
  const [generatingProgress, setGeneratingProgress] = useState('')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  const [showBaseline, setShowBaseline] = useState(false)
  const [confirmRegen, setConfirmRegen] = useState(false)
  const [showStyleModal, setShowStyleModal] = useState(false)
  const [teachingStyle, setTeachingStyle] = useState('balanced')

  useEffect(() => {
    getCourse(id)
      .then((c) => {
        setCourse(c)
        return generateBaseline(id)
      })
      .then((curriculum) => {
        const loaded = curriculum.content.chapters
        setBaselineChapters(loaded)
        setChapters(JSON.parse(JSON.stringify(loaded)))
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

  async function handleRegenerate() {
    setConfirmRegen(false)
    setPhase('loading')
    try {
      const curriculum = await generateBaseline(id)
      const loaded = curriculum.content.chapters
      setBaselineChapters(loaded)
      setChapters(JSON.parse(JSON.stringify(loaded)))
    } catch {
      setError('Regeneration failed.')
    } finally {
      setPhase('ready')
    }
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

  async function handleFinalize(style: string) {
    setShowStyleModal(false)
    setError('')
    try {
      setPhase('finalizing')
      await updateCurriculum(id, chapters)
      await finalizeCurriculum(id)
      setPhase('generating')
      setGeneratingProgress(`Generating ${chapters.length} lectures…`)
      await generateLectures(id, style)
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
      saveInspiration(id, inspiredUniversity || '', '', selectedChapters).catch(() => {})
    } catch {
      setError('Blend failed — applying chapters manually instead.')
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

  if (phase === 'loading') return <LoadingScreen phase="loading" />
  if (phase === 'blending') return <LoadingScreen phase="blending" />
  if (phase === 'finalizing') return <LoadingScreen phase="finalizing" />
  if (phase === 'generating') return <LoadingScreen phase="generating" extra={generatingProgress || undefined} />

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <AppHeader
        backHref="/"
        backLabel="My Courses"
        right={
          <div className="flex items-center gap-2">
            {/* Regenerate baseline */}
            {!confirmRegen ? (
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => setConfirmRegen(true)}
                className="flex items-center gap-1.5 font-label text-xs text-on-surface-variant hover:text-on-surface border border-outline-variant rounded-full px-3 py-1.5 transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
                Regenerate
              </motion.button>
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-2 bg-surface-container rounded-full px-3 py-1.5"
              >
                <span className="font-label text-xs text-on-surface-variant">Reset edits?</span>
                <button onClick={handleRegenerate} className="font-label text-xs font-semibold text-on-surface hover:underline">Yes</button>
                <button onClick={() => setConfirmRegen(false)} className="font-label text-xs text-on-surface-variant hover:text-on-surface">Cancel</button>
              </motion.div>
            )}
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleSave}
              disabled={saving}
              className="font-label text-xs text-on-surface-variant hover:text-on-surface border border-outline-variant rounded-full px-3 py-1.5 transition-colors disabled:opacity-40"
            >
              {saving ? 'Saving…' : 'Save Draft'}
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowStyleModal(true)}
              disabled={chapters.length === 0}
              className="font-label text-xs font-semibold bg-primary text-on-primary rounded-full px-4 py-1.5 hover:bg-primary-container disabled:opacity-40 transition-colors"
            >
              Finalise & Generate →
            </motion.button>
          </div>
        }
      />

      {/* Title row */}
      <div className="px-6 py-3 bg-surface-container-lowest border-b border-outline-variant/30">
        <h1 className="font-headline font-[500] text-base text-on-surface tracking-[-0.02em]">
          {course?.course_name}
          {course?.course_code && <span className="font-label text-sm text-on-surface-variant ml-2">({course.course_code})</span>}
        </h1>
        <p className="font-label text-xs text-on-surface-variant mt-0.5">
          {course?.university_name} · {course?.grade_level || 'Undergraduate'}
        </p>
      </div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-error/10 px-6 py-2 text-xs text-error font-label overflow-hidden"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left: Curriculum editor */}
        <div className="w-2/5 border-r border-outline-variant/30 bg-surface-container-lowest flex flex-col overflow-hidden">

          {/* Baseline toggle */}
          <div className="border-b border-outline-variant/30">
            <button
              onClick={() => setShowBaseline(!showBaseline)}
              className="w-full flex items-center justify-between px-5 py-3 hover:bg-surface-container-low transition-colors text-sm"
            >
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-on-surface-variant shrink-0" />
                <span className="font-label text-xs text-on-surface-variant">
                  {course?.university_name} Official
                </span>
                <span className="font-label text-[10px] text-outline">({baselineChapters.length} ch)</span>
              </div>
              {showBaseline
                ? <ChevronUp className="w-3.5 h-3.5 text-outline" />
                : <ChevronDown className="w-3.5 h-3.5 text-outline" />}
            </button>

            <AnimatePresence>
              {showBaseline && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="bg-surface-container-low px-5 pb-4 max-h-56 overflow-y-auto border-t border-outline-variant/20">
                    <p className="font-label text-[10px] text-on-surface-variant py-2 uppercase tracking-wide">
                      Read-only — reference curriculum
                    </p>
                    <ol className="space-y-2">
                      {baselineChapters.map((ch) => (
                        <li key={ch.number} className="text-xs">
                          <span className="font-label font-semibold text-on-surface">{ch.number}. {ch.title}</span>
                          {ch.topics.length > 0 && (
                            <p className="text-outline mt-0.5 truncate">{ch.topics.join(' · ')}</p>
                          )}
                        </li>
                      ))}
                    </ol>
                    <button
                      onClick={resetToBaseline}
                      className="mt-3 flex items-center gap-1 font-label text-xs text-on-surface-variant hover:text-on-surface transition-colors"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Reset to this baseline
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Editor header */}
          <div className="px-5 py-3 border-b border-outline-variant/30 flex items-center justify-between">
            <div>
              <p className="font-label text-xs font-semibold text-on-surface">Your Curriculum</p>
              <p className="font-label text-[10px] text-on-surface-variant mt-0.5">Edit chapters · Add from map · Upload files</p>
            </div>
            <label className="cursor-pointer">
              <motion.span
                whileTap={{ scale: 0.95 }}
                className="flex items-center gap-1 font-label text-xs text-on-surface-variant hover:text-on-surface border border-outline-variant rounded-full px-2.5 py-1 transition-colors"
              >
                <Upload className="w-3 h-3" />
                {uploading ? 'Uploading…' : 'Upload'}
              </motion.span>
              <input
                type="file"
                className="hidden"
                accept=".pdf,.txt,.docx"
                onChange={handleFileUpload}
                disabled={uploading}
              />
            </label>
          </div>

          {/* Chapters */}
          <div className="flex-1 overflow-y-auto p-4 space-y-1.5">
            <motion.div
              initial="hidden"
              animate="show"
              variants={{ show: { transition: { staggerChildren: 0.03 } } }}
              className="space-y-1.5"
            >
              <AnimatePresence>
                {chapters.map((ch, idx) => (
                  <motion.div
                    key={idx}
                    layout
                    variants={itemVariants}
                    exit={{ opacity: 0, x: -8, transition: { duration: 0.15 } }}
                    className={`rounded-lg p-3 cursor-pointer transition-colors ${
                      editingIdx === idx
                        ? 'bg-surface-container'
                        : 'bg-surface-container-low hover:bg-surface-container'
                    }`}
                    onClick={() => setEditingIdx(editingIdx === idx ? null : idx)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex gap-2.5 flex-1 min-w-0 items-baseline">
                        <span className="font-label text-[10px] text-on-surface-variant shrink-0">{ch.number}</span>
                        {editingIdx === idx ? (
                          <input
                            className="flex-1 text-xs font-semibold text-on-surface bg-transparent border-b border-outline focus:outline-none"
                            value={ch.title}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => updateChapter(idx, 'title', e.target.value)}
                          />
                        ) : (
                          <span className="text-xs font-semibold text-on-surface truncate">{ch.title}</span>
                        )}
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); removeChapter(idx) }}
                        className="text-outline hover:text-error shrink-0 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>

                    <AnimatePresence>
                      {editingIdx === idx && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.18 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-2 space-y-1.5" onClick={(e) => e.stopPropagation()}>
                            <textarea
                              className="w-full text-xs bg-surface-container-lowest rounded px-2.5 py-2 resize-none focus:outline-none placeholder:text-outline min-h-[48px]"
                              placeholder="Description…"
                              value={ch.description || ''}
                              onChange={(e) => updateChapter(idx, 'description', e.target.value)}
                            />
                            <input
                              className="w-full text-xs bg-surface-container-lowest rounded px-2.5 py-2 focus:outline-none placeholder:text-outline"
                              placeholder="Topics (comma separated)"
                              value={ch.topics.join(', ')}
                              onChange={(e) =>
                                updateChapter(idx, 'topics', e.target.value.split(',').map((t) => t.trim()).filter(Boolean))
                              }
                            />
                            <input
                              className="w-full text-xs bg-surface-container-lowest rounded px-2.5 py-2 focus:outline-none placeholder:text-outline"
                              placeholder="Learning outcomes (comma separated)"
                              value={ch.learning_outcomes.join(', ')}
                              onChange={(e) =>
                                updateChapter(idx, 'learning_outcomes', e.target.value.split(',').map((t) => t.trim()).filter(Boolean))
                              }
                            />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {ch.topics.length > 0 && editingIdx !== idx && (
                      <p className="text-[10px] text-outline mt-1.5 truncate pl-5">{ch.topics.join(' · ')}</p>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>

            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={addChapter}
              className="w-full py-2.5 rounded-lg border border-dashed border-outline-variant text-xs text-on-surface-variant hover:text-on-surface hover:border-outline transition-colors flex items-center justify-center gap-1.5 font-label"
            >
              <Plus className="w-3.5 h-3.5" />
              Add chapter
            </motion.button>
          </div>
        </div>

        {/* Right: Map */}
        <div className="flex-1 flex flex-col">
          {course && (
            <MapboxMap courseId={id} courseName={course.course_name} onInspire={(chapters, uni) => handleInspire(chapters, uni)} />
          )}
        </div>
      </div>

      {/* Teaching style modal */}
      <AnimatePresence>
        {showStyleModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ type: 'spring', stiffness: 280, damping: 26 }}
              className="bg-surface-container-lowest rounded-2xl p-6 w-full max-w-sm shadow-xl"
            >
              <p className="font-label text-[10px] tracking-[0.18em] text-on-surface-variant uppercase mb-1">Step 1 of 1</p>
              <h3 className="font-headline font-[540] text-lg tracking-[-0.02em] text-on-surface mb-1">
                Teaching style
              </h3>
              <p className="font-label text-xs text-on-surface-variant mb-5">
                Lectures will be written to match your preferred delivery approach.
              </p>

              <div className="space-y-2 mb-6">
                {TEACHING_STYLES.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setTeachingStyle(s.id)}
                    className={`w-full text-left rounded-lg px-4 py-3 border transition-colors ${
                      teachingStyle === s.id
                        ? 'border-on-surface bg-surface-container'
                        : 'border-outline-variant hover:border-outline bg-surface-container-low'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-label text-xs font-semibold text-on-surface">{s.label}</p>
                      {teachingStyle === s.id && (
                        <span className="w-2 h-2 rounded-full bg-on-surface shrink-0" />
                      )}
                    </div>
                    <p className="font-label text-[10px] text-on-surface-variant mt-0.5">{s.desc}</p>
                  </button>
                ))}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowStyleModal(false)}
                  className="flex-1 py-2.5 font-label text-xs text-on-surface-variant border border-outline-variant rounded-full hover:border-outline transition-colors"
                >
                  Cancel
                </button>
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleFinalize(teachingStyle)}
                  className="flex-1 py-2.5 font-label text-xs font-semibold bg-primary text-on-primary rounded-full hover:bg-primary-container transition-colors"
                >
                  Generate Lectures →
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
