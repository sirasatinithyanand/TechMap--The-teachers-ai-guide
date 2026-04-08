'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Download, LayoutDashboard, ChevronRight, BookOpen, Edit3, FileText, FileType, Check } from 'lucide-react'
import AppHeader from '@/components/AppHeader'
import type { Course, Lecture } from '@/lib/api'
import { getCourse, listLectures, exportLecturesWithNotes } from '@/lib/api'

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 200, damping: 22 } },
}

const SECTION_OPTIONS = [
  { key: 'revision',  label: 'Revision' },
  { key: 'outcomes',  label: 'Learning Outcomes' },
  { key: 'concepts',  label: 'Key Concepts' },
  { key: 'content',   label: 'Lecture Content' },
  { key: 'resources', label: 'Pre-Lecture Resources' },
  { key: 'guide',     label: 'Teaching Guide' },
  { key: 'notes',     label: 'My Notes' },
] as const

type SectionKey = typeof SECTION_OPTIONS[number]['key']

export default function LecturesPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [course, setCourse] = useState<Course | null>(null)
  const [lectures, setLectures] = useState<Lecture[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [showFormatModal, setShowFormatModal] = useState(false)
  const [selectedFormat, setSelectedFormat] = useState<'txt' | 'pdf' | null>(null)
  const [selectedSections, setSelectedSections] = useState<Set<SectionKey>>(
    new Set(['revision', 'outcomes', 'concepts', 'content', 'resources', 'guide', 'notes'])
  )

  function toggleSection(key: SectionKey) {
    setSelectedSections(prev => {
      const next = new Set(prev)
      if (next.has(key)) { next.delete(key) } else { next.add(key) }
      return next
    })
  }

  async function handleExport() {
    if (!selectedFormat || selectedSections.size === 0) return
    setShowFormatModal(false)
    setExporting(true)
    try {
      const notes: Record<string, string> = {}
      lectures.forEach((lec) => {
        const n = localStorage.getItem(`tm_notes_${lec.id}`)
        if (n?.trim()) notes[lec.id] = n
      })
      const blob = await exportLecturesWithNotes(id, notes, selectedFormat, [...selectedSections])
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${(course?.course_name || 'course').replace(/\s+/g, '_')}_lectures_${selectedFormat}.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      // silently fail — user can retry
    } finally {
      setExporting(false)
    }
  }

  useEffect(() => {
    Promise.all([getCourse(id), listLectures(id)])
      .then(([c, l]) => { setCourse(c); setLectures(l) })
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="min-h-screen bg-surface">
        <div className="h-14 bg-surface-container-lowest border-b border-outline-variant/40" />
        <div className="max-w-3xl mx-auto px-6 py-8 space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="skeleton h-16 rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface">
      <AppHeader
        backHref="/"
        backLabel="My Courses"
        right={
          <div className="flex items-center gap-2">
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => router.push(`/course/${id}/curriculum`)}
              className="flex items-center gap-1.5 font-label text-xs text-on-surface-variant hover:text-on-surface border border-outline-variant rounded-full px-3 py-1.5 transition-colors"
            >
              <Edit3 className="w-3 h-3" />
              Edit Curriculum
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => setShowFormatModal(true)}
              disabled={exporting}
              className="flex items-center gap-1.5 font-label text-xs text-on-surface-variant hover:text-on-surface border border-outline-variant rounded-full px-3 py-1.5 transition-colors disabled:opacity-40"
            >
              <Download className="w-3 h-3" />
              {exporting ? 'Exporting…' : 'Export ZIP'}
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => router.push(`/course/${id}/dashboard`)}
              className="flex items-center gap-1.5 font-label text-xs font-semibold bg-primary text-on-primary rounded-full px-4 py-1.5 hover:bg-primary-container transition-colors"
            >
              <LayoutDashboard className="w-3 h-3" />
              Dashboard
            </motion.button>
          </div>
        }
      />

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="max-w-3xl mx-auto px-6 py-8"
      >
        <div className="mb-6">
          <p className="font-label text-xs tracking-[0.18em] text-on-surface-variant uppercase mb-1">
            {course?.university_name}
          </p>
          <h1 className="font-headline font-[540] text-2xl tracking-[-0.03em] text-on-surface">
            {course?.course_name}
          </h1>
          <p className="font-label text-xs text-on-surface-variant mt-1">{lectures.length} lectures generated</p>
        </div>

        {lectures.length === 0 ? (
          <div className="bg-surface-container-low rounded-lg p-10 text-center">
            <BookOpen className="w-8 h-8 text-outline mx-auto mb-3" />
            <p className="text-sm text-on-surface-variant">No lectures yet.</p>
          </div>
        ) : (
          <motion.div
            className="space-y-1.5"
            initial="hidden"
            animate="show"
            variants={{ show: { transition: { staggerChildren: 0.04 } } }}
          >
            {lectures.map((lec) => (
              <motion.button
                key={lec.id}
                variants={itemVariants}
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => router.push(`/course/${id}/lectures/${lec.lecture_number}`)}
                className="w-full text-left bg-surface-container-lowest rounded-lg px-5 py-4 shadow-card hover:bg-surface-container-low transition-colors group"
              >
                <div className="flex items-center gap-4">
                  <span className="font-label text-xl font-bold text-surface-container-highest group-hover:text-outline transition-colors w-7 shrink-0 leading-none">
                    {lec.lecture_number}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-headline font-[500] text-sm text-on-surface truncate">
                      {lec.title}
                    </p>
                    {lec.content.key_concepts.length > 0 && (
                      <p className="font-label text-xs text-on-surface-variant mt-0.5 truncate">
                        {lec.content.key_concepts.slice(0, 4).join(' · ')}
                        {lec.content.key_concepts.length > 4 && ' · …'}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {lec.revision_content && (
                      <span className="font-label text-[10px] tracking-wide uppercase px-2 py-0.5 bg-surface-container text-on-surface-variant rounded-full">
                        Revised
                      </span>
                    )}
                    <span className={`font-label text-[10px] tracking-wide uppercase px-2 py-0.5 rounded-full ${
                      lec.status === 'published'
                        ? 'bg-on-surface text-surface-container-lowest'
                        : 'bg-surface-container text-on-surface-variant'
                    }`}>
                      {lec.status}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-outline group-hover:text-on-surface transition-colors" />
                  </div>
                </div>
              </motion.button>
            ))}
          </motion.div>
        )}
      </motion.div>

      {/* Export modal */}
      <AnimatePresence>
        {showFormatModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
            onClick={() => setShowFormatModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-surface-container-lowest rounded-2xl p-6 w-full max-w-sm shadow-xl"
            >
              <h3 className="font-headline font-[540] text-base tracking-[-0.02em] text-on-surface mb-1">
                Export lectures
              </h3>
              <p className="font-label text-xs text-on-surface-variant mb-5">
                Choose format and what to include in each file.
              </p>

              {/* Format toggle */}
              <p className="font-label text-[10px] tracking-widest text-on-surface-variant uppercase mb-2">Format</p>
              <div className="flex gap-2 mb-5">
                {(['pdf', 'txt'] as const).map((fmt) => (
                  <button
                    key={fmt}
                    onClick={() => setSelectedFormat(fmt)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-label font-semibold transition-colors ${
                      selectedFormat === fmt
                        ? 'border-on-surface bg-on-surface text-surface-container-lowest'
                        : 'border-outline-variant text-on-surface-variant hover:border-on-surface hover:text-on-surface'
                    }`}
                  >
                    {fmt === 'pdf' ? <FileType className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                    {fmt === 'pdf' ? 'PDF' : 'Plain text'}
                  </button>
                ))}
              </div>

              {/* Section checkboxes */}
              <p className="font-label text-[10px] tracking-widest text-on-surface-variant uppercase mb-2">Include</p>
              <div className="space-y-1 mb-5">
                {SECTION_OPTIONS.map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => toggleSection(key)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-container-low transition-colors text-left"
                  >
                    <div className={`w-4 h-4 rounded flex items-center justify-center border transition-colors shrink-0 ${
                      selectedSections.has(key)
                        ? 'bg-on-surface border-on-surface'
                        : 'border-outline-variant'
                    }`}>
                      {selectedSections.has(key) && <Check className="w-2.5 h-2.5 text-surface-container-lowest" />}
                    </div>
                    <span className="font-label text-sm text-on-surface">{label}</span>
                  </button>
                ))}
              </div>

              {/* Export button */}
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={handleExport}
                disabled={!selectedFormat || selectedSections.size === 0}
                className="w-full py-2.5 bg-primary text-on-primary font-label text-sm font-semibold rounded-full hover:bg-primary-container disabled:opacity-40 transition-colors"
              >
                Download ZIP
              </motion.button>

              <button
                onClick={() => setShowFormatModal(false)}
                className="w-full mt-3 py-2 font-label text-xs text-on-surface-variant hover:text-on-surface transition-colors"
              >
                Cancel
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
