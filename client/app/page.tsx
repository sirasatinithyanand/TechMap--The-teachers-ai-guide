'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, BookOpen, Clock } from 'lucide-react'
import AppHeader from '@/components/AppHeader'
import { parseCourse, getProfessorCourses } from '@/lib/api'
import type { Course } from '@/lib/api'

interface Professor {
  id: string
  name: string
}

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 200, damping: 22 } },
}

export default function LandingPage() {
  const router = useRouter()
  const [professor, setProfessor] = useState<Professor | null>(null)
  const [courses, setCourses] = useState<Course[]>([])
  const [sentence, setSentence] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [loadingCourses, setLoadingCourses] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('tm_professor')
    if (!stored) { router.push('/login'); return }
    const prof: Professor = JSON.parse(stored)
    setProfessor(prof)
    setLoadingCourses(true)
    getProfessorCourses(prof.id)
      .then(setCourses)
      .finally(() => setLoadingCourses(false))
  }, [router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!sentence.trim()) return
    setLoading(true)
    setError('')
    try {
      const parsed = await parseCourse(sentence)
      localStorage.setItem('tm_parsed', JSON.stringify(parsed))
      localStorage.setItem('tm_raw', sentence)
      router.push('/confirm')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  if (!professor) return null

  return (
    <div className="min-h-screen bg-surface">
      <AppHeader />

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="max-w-2xl mx-auto px-6 py-12"
      >
        {/* Hero */}
        <div className="mb-10">
          <p className="font-label text-xs tracking-[0.18em] text-on-surface-variant uppercase mb-3">
            Curriculum Builder
          </p>
          <h1 className="font-headline font-[540] text-4xl tracking-[-0.035em] text-on-surface leading-tight mb-2">
            Welcome back,<br />{professor.name}.
          </h1>
          <p className="text-sm text-on-surface-variant">
            Describe a new course to get started, or continue with an existing one below.
          </p>
        </div>

        {/* New course input */}
        <form onSubmit={handleSubmit} className="bg-surface-container-lowest rounded-lg p-6 shadow-card mb-8 space-y-4">
          <label className="font-label text-xs tracking-widest text-on-surface-variant uppercase block">
            New Course
          </label>
          <textarea
            className="w-full bg-surface-container-low rounded-lg px-4 py-3 text-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-1 focus:ring-outline transition resize-none min-h-[80px]"
            placeholder='e.g. "I teach COMP1511 at UNSW for first year undergrads"'
            value={sentence}
            onChange={(e) => setSentence(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSubmit(e as unknown as React.FormEvent)
              }
            }}
          />
          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-error text-xs font-label"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>
          <motion.button
            type="submit"
            disabled={loading || !sentence.trim()}
            whileTap={{ scale: 0.98 }}
            className="flex items-center justify-center gap-2 w-full py-3 bg-primary text-on-primary font-label text-sm font-semibold rounded-full hover:bg-primary-container disabled:opacity-40 transition-colors"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
                Analysing…
              </>
            ) : (
              <>
                Build My Curriculum
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </motion.button>
        </form>

        {/* My Courses */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="font-label text-xs tracking-widest text-on-surface-variant uppercase">
              My Courses
            </p>
            {courses.length > 0 && (
              <span className="font-label text-xs text-outline">{courses.length} total</span>
            )}
          </div>

          {loadingCourses ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="skeleton h-16 rounded-lg" />
              ))}
            </div>
          ) : courses.length === 0 ? (
            <div className="bg-surface-container-low rounded-lg p-8 text-center">
              <BookOpen className="w-8 h-8 text-outline mx-auto mb-3" />
              <p className="text-sm text-on-surface-variant">No courses yet — create your first one above.</p>
            </div>
          ) : (
            <motion.div
              className="space-y-2"
              initial="hidden"
              animate="show"
              variants={{ show: { transition: { staggerChildren: 0.05 } } }}
            >
              {courses.map((c) => (
                <motion.button
                  key={c.id}
                  variants={itemVariants}
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => router.push(c.status === 'active' ? `/course/${c.id}/lectures` : `/course/${c.id}/dashboard`)}
                  className="w-full text-left bg-surface-container-lowest rounded-lg px-5 py-4 shadow-card hover:bg-surface-container-low transition-colors group"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-headline font-[500] text-sm text-on-surface truncate group-hover:text-primary-container transition-colors">
                        {c.course_name}
                      </p>
                      <p className="font-label text-xs text-on-surface-variant mt-0.5 truncate">
                        {c.university_name}
                        {c.course_code ? ` · ${c.course_code}` : ''}
                        {c.grade_level ? ` · ${c.grade_level}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {c.status === 'active' ? (
                        <span className="font-label text-[10px] tracking-wide uppercase px-2 py-0.5 bg-on-surface text-surface-container-lowest rounded-full">
                          Active
                        </span>
                      ) : (
                        <span className="font-label text-[10px] tracking-wide uppercase px-2 py-0.5 bg-surface-container text-on-surface-variant rounded-full flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          Draft
                        </span>
                      )}
                      <ArrowRight className="w-3.5 h-3.5 text-outline group-hover:text-on-surface transition-colors" />
                    </div>
                  </div>
                </motion.button>
              ))}
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  )
}
