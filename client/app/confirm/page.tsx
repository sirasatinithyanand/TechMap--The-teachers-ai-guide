'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, Pencil, Check } from 'lucide-react'
import AppHeader from '@/components/AppHeader'
import type { ParsedCourse } from '@/lib/api'
import { createCourse } from '@/lib/api'

export default function ConfirmPage() {
  const router = useRouter()
  const [parsed, setParsed] = useState<ParsedCourse | null>(null)
  const [raw, setRaw] = useState('')
  const [professorName, setProfessorName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const [editValues, setEditValues] = useState({ university_name: '', course_name: '', course_code: '', grade_level: '' })

  useEffect(() => {
    const p = localStorage.getItem('tm_parsed')
    const r = localStorage.getItem('tm_raw')
    if (!p) { router.push('/'); return }
    const data: ParsedCourse = JSON.parse(p)
    setParsed(data)
    setRaw(r || '')
    setEditValues({
      university_name: data.university_name || '',
      course_name: data.course_name || '',
      course_code: data.course_code || '',
      grade_level: data.grade_level || '',
    })
    const prof = localStorage.getItem('tm_professor')
    if (prof) setProfessorName(JSON.parse(prof).name)
  }, [router])

  function saveEdits() {
    setParsed((prev) => prev ? { ...prev, ...editValues } : prev)
    setEditing(false)
  }

  async function handleConfirm() {
    if (!parsed) return
    setLoading(true)
    setError('')
    try {
      const course = await createCourse({
        professor_name: professorName.trim() || 'Professor',
        university_name: parsed.university_name,
        course_name: parsed.course_name,
        course_code: parsed.course_code,
        grade_level: parsed.grade_level,
        raw_input: raw,
      })
      localStorage.removeItem('tm_parsed')
      localStorage.removeItem('tm_raw')
      router.push(`/course/${course.id}/curriculum`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create course.')
    } finally {
      setLoading(false)
    }
  }

  if (!parsed) return null

  const displayFields = [
    { label: 'University', key: 'university_name' as const, value: parsed.university_name },
    { label: 'Course', key: 'course_name' as const, value: parsed.course_name },
    { label: 'Course Code', key: 'course_code' as const, value: parsed.course_code || '—' },
    { label: 'Level', key: 'grade_level' as const, value: parsed.grade_level || '—' },
  ]

  return (
    <div className="min-h-screen bg-surface">
      <AppHeader backHref="/" backLabel="Back" />

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="max-w-lg mx-auto px-6 py-12"
      >
        <div className="mb-8">
          <p className="font-label text-xs tracking-[0.18em] text-on-surface-variant uppercase mb-3">
            Confirm Details
          </p>
          <h1 className="font-headline font-[540] text-3xl tracking-[-0.03em] text-on-surface leading-tight">
            Does this look right?
          </h1>
          <p className="text-sm text-on-surface-variant mt-2">
            We extracted these details from your description. Edit anything that looks off.
          </p>
        </div>

        <div className="bg-surface-container-lowest rounded-lg shadow-card overflow-hidden mb-3">
          {displayFields.map(({ label, key, value }, i) => (
            <div
              key={label}
              className={`flex items-center justify-between px-5 py-4 ${i < displayFields.length - 1 ? 'border-b border-surface-container' : ''}`}
            >
              <span className="font-label text-xs tracking-wide text-on-surface-variant uppercase shrink-0 mr-4">{label}</span>
              {editing ? (
                <input
                  className="flex-1 text-right bg-surface-container-low rounded px-2 py-1 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-outline"
                  value={editValues[key]}
                  onChange={(e) => setEditValues((prev) => ({ ...prev, [key]: e.target.value }))}
                  placeholder={label}
                />
              ) : (
                <span className="font-headline font-[500] text-sm text-on-surface text-right">{value}</span>
              )}
            </div>
          ))}
        </div>

        <div className="flex justify-end mb-6">
          {editing ? (
            <button
              onClick={saveEdits}
              className="flex items-center gap-1.5 font-label text-xs font-semibold text-on-surface hover:text-primary-container transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
              Done editing
            </button>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 font-label text-xs text-on-surface-variant hover:text-on-surface transition-colors"
            >
              <Pencil className="w-3 h-3" />
              Edit details
            </button>
          )}
        </div>

        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-error text-xs font-label mb-4"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={handleConfirm}
          disabled={loading || editing}
          className="flex items-center justify-center gap-2 w-full py-3 bg-primary text-on-primary font-label text-sm font-semibold rounded-full hover:bg-primary-container disabled:opacity-40 transition-colors"
        >
          {loading ? (
            <>
              <span className="w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
              Creating…
            </>
          ) : (
            <>
              Generate Curriculum
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </motion.button>
      </motion.div>
    </div>
  )
}
