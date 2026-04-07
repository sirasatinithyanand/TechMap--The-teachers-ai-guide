'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { BookOpen, MessageSquare, Star, Target } from 'lucide-react'
import AppHeader from '@/components/AppHeader'
import type { Course, Lecture, FeedbackSummary, QuizResult } from '@/lib/api'
import {
  getCourse,
  listLectures,
  getFeedbackSummary,
  getQuizResults,
  listQuestions,
  getQuiz,
} from '@/lib/api'

interface LectureSummary {
  lecture: Lecture
  feedback: FeedbackSummary | null
  quiz: QuizResult | null
  questionCount: number
}

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={`skeleton rounded-lg ${className ?? ''}`} />
}

function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-surface">
      <div className="h-14 bg-surface-container-lowest border-b border-outline-variant/40" />
      <div className="max-w-6xl mx-auto px-6 py-6 grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-surface-container-lowest rounded-lg p-5 space-y-3">
            <SkeletonBlock className="h-3.5 w-20" />
            <SkeletonBlock className="h-8 w-16" />
          </div>
        ))}
      </div>
      <div className="max-w-6xl mx-auto px-6 pb-8 grid grid-cols-3 gap-6">
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-surface-container-lowest rounded-lg p-4 space-y-2">
              <SkeletonBlock className="h-4 w-3/4" />
              <SkeletonBlock className="h-3 w-1/2" />
            </div>
          ))}
        </div>
        <div className="col-span-2">
          <div className="bg-surface-container-lowest rounded-lg p-6 space-y-4">
            <SkeletonBlock className="h-6 w-56" />
            <div className="grid grid-cols-2 gap-4">
              <SkeletonBlock className="h-28 rounded-lg" />
              <SkeletonBlock className="h-28 rounded-lg" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ProgressBar({ value, animate = true }: { value: number; animate?: boolean }) {
  const [width, setWidth] = useState(0)
  useEffect(() => {
    if (animate) {
      const t = setTimeout(() => setWidth(value), 100)
      return () => clearTimeout(t)
    }
    setWidth(value)
  }, [value, animate])

  return (
    <div className="w-full h-1.5 bg-surface-container rounded-full overflow-hidden">
      <div
        className="h-full rounded-full bg-on-surface transition-all duration-700 ease-out"
        style={{ width: `${Math.round(width * 100)}%` }}
      />
    </div>
  )
}

const STAT_ICONS = [BookOpen, Star, MessageSquare, Target]

export default function DashboardPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [course, setCourse] = useState<Course | null>(null)
  const [summaries, setSummaries] = useState<LectureSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<LectureSummary | null>(null)

  useEffect(() => {
    async function load() {
      const [c, lectures] = await Promise.all([getCourse(id), listLectures(id)])
      setCourse(c)
      const results = await Promise.all(
        lectures.map(async (lec) => {
          const [feedback, questions] = await Promise.all([
            getFeedbackSummary(lec.id).catch(() => null),
            listQuestions(lec.id).catch(() => []),
          ])
          let quiz: QuizResult | null = null
          try {
            const q = await getQuiz(lec.id)
            quiz = await getQuizResults(q.id)
          } catch {}
          return { lecture: lec, feedback, quiz, questionCount: questions.length }
        })
      )
      setSummaries(results)
      if (results.length) setSelected(results[0])
    }
    load().finally(() => setLoading(false))
  }, [id])

  if (loading) return <DashboardSkeleton />

  const ratedSummaries = summaries.filter((s) => s.feedback?.avg_rating)
  const avgRating =
    ratedSummaries.length > 0
      ? ratedSummaries.reduce((acc, s) => acc + (s.feedback?.avg_rating || 0), 0) / ratedSummaries.length
      : null

  const quizzedSummaries = summaries.filter((s) => s.quiz && s.quiz.total_submissions > 0)
  const avgQuiz =
    quizzedSummaries.length > 0
      ? quizzedSummaries.reduce((a, s) => a + (s.quiz?.avg_score || 0), 0) / quizzedSummaries.length
      : null

  const totalQuestions = summaries.reduce((a, s) => a + s.questionCount, 0)

  const stats = [
    { label: 'Lectures', value: summaries.length, suffix: '', Icon: STAT_ICONS[0] },
    { label: 'Avg Rating', value: avgRating ? avgRating.toFixed(1) : '—', suffix: avgRating ? ' / 5' : '', Icon: STAT_ICONS[1] },
    { label: 'Total Questions', value: totalQuestions, suffix: '', Icon: STAT_ICONS[2] },
    { label: 'Avg Quiz Score', value: avgQuiz ? `${(avgQuiz * 100).toFixed(0)}` : '—', suffix: avgQuiz ? '%' : '', Icon: STAT_ICONS[3] },
  ]

  return (
    <div className="min-h-screen bg-surface">
      <AppHeader
        backHref={`/course/${id}/lectures`}
        backLabel="Lectures"
      />

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="max-w-6xl mx-auto px-6 py-8"
      >
        {/* Course heading */}
        <div className="mb-6">
          <p className="font-label text-xs tracking-[0.18em] text-on-surface-variant uppercase mb-1">
            {course?.university_name}
          </p>
          <h1 className="font-headline font-[540] text-2xl tracking-[-0.03em] text-on-surface">
            {course?.course_name}
          </h1>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {stats.map(({ label, value, suffix, Icon }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06, type: 'spring', stiffness: 200, damping: 22 }}
              className="bg-surface-container-lowest rounded-lg p-5 shadow-card"
            >
              <div className="flex items-center justify-between mb-3">
                <p className="font-label text-xs tracking-wide text-on-surface-variant uppercase">{label}</p>
                <Icon className="w-3.5 h-3.5 text-outline" />
              </div>
              <p className="font-label font-bold text-3xl text-on-surface leading-none">
                {value}
                <span className="text-base font-normal text-on-surface-variant">{suffix}</span>
              </p>
            </motion.div>
          ))}
        </div>

        {/* Main 3-col layout */}
        <div className="grid grid-cols-3 gap-6">
          {/* Lecture list */}
          <div className="space-y-1.5">
            <p className="font-label text-xs tracking-widest text-on-surface-variant uppercase mb-3 px-1">Lectures</p>
            {summaries.map((s, i) => {
              const isSelected = selected?.lecture.id === s.lecture.id
              const rating = s.feedback?.avg_rating
              const quizScore = s.quiz?.avg_score
              return (
                <motion.button
                  key={s.lecture.id}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + i * 0.04, type: 'spring', stiffness: 200, damping: 22 }}
                  onClick={() => setSelected(s)}
                  className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                    isSelected
                      ? 'bg-on-surface text-surface-container-lowest'
                      : 'bg-surface-container-lowest hover:bg-surface-container-low shadow-card'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className={`font-label text-xs font-bold w-5 shrink-0 mt-0.5 ${isSelected ? 'text-surface-container-highest' : 'text-on-surface-variant'}`}>
                      {s.lecture.lecture_number}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className={`font-headline font-[500] text-xs truncate ${isSelected ? 'text-on-primary' : 'text-on-surface'}`}>
                        {s.lecture.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        {rating ? (
                          <span className={`font-label text-[10px] ${isSelected ? 'text-surface-container-highest' : 'text-on-surface-variant'}`}>★ {rating.toFixed(1)}</span>
                        ) : null}
                        {quizScore != null ? (
                          <span className={`font-label text-[10px] ${isSelected ? 'text-surface-container-highest' : 'text-on-surface-variant'}`}>
                            {(quizScore * 100).toFixed(0)}%
                          </span>
                        ) : null}
                        {!rating && quizScore == null && (
                          <span className={`font-label text-[10px] ${isSelected ? 'text-surface-container-high' : 'text-outline'}`}>No data</span>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.button>
              )
            })}
          </div>

          {/* Detail panel */}
          {selected && (
            <motion.div
              key={selected.lecture.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="col-span-2 space-y-4"
            >
              <div className="bg-surface-container-lowest rounded-lg p-6 shadow-card">
                <h2 className="font-headline font-[540] text-lg tracking-[-0.02em] text-on-surface mb-1">
                  Lecture {selected.lecture.lecture_number}: {selected.lecture.title}
                </h2>
                <p className="font-label text-xs text-on-surface-variant mb-5">
                  {selected.questionCount} student question{selected.questionCount !== 1 ? 's' : ''} ·{' '}
                  {selected.feedback?.total_responses || 0} feedback response{(selected.feedback?.total_responses || 0) !== 1 ? 's' : ''}
                </p>

                {/* Metrics row */}
                <div className="grid grid-cols-2 gap-4 mb-5">
                  {/* Feedback card */}
                  <div className="bg-surface-container-low rounded-lg p-4">
                    <p className="font-label text-xs tracking-wide text-on-surface-variant uppercase mb-3">Student Feedback</p>
                    {selected.feedback && selected.feedback.total_responses > 0 ? (
                      <>
                        <div className="flex items-baseline gap-1.5 mb-2">
                          <p className="font-label font-bold text-4xl text-on-surface">
                            {selected.feedback.avg_rating.toFixed(1)}
                          </p>
                          <p className="font-label text-sm text-on-surface-variant">/ 5</p>
                        </div>
                        <ProgressBar value={selected.feedback.avg_rating / 5} />
                        <p className="font-label text-xs text-outline mt-2">
                          {selected.feedback.total_responses} responses
                        </p>
                      </>
                    ) : (
                      <p className="font-label text-sm text-on-surface-variant py-3">No feedback yet</p>
                    )}
                  </div>

                  {/* Quiz card */}
                  <div className="bg-surface-container-low rounded-lg p-4">
                    <p className="font-label text-xs tracking-wide text-on-surface-variant uppercase mb-3">Quiz Results</p>
                    {selected.quiz && selected.quiz.total_submissions > 0 ? (
                      <>
                        <div className="flex items-baseline gap-0.5 mb-2">
                          <p className="font-label font-bold text-4xl text-on-surface">
                            {(selected.quiz.avg_score * 100).toFixed(0)}
                          </p>
                          <p className="font-label text-sm text-on-surface-variant">%</p>
                        </div>
                        <ProgressBar value={selected.quiz.avg_score} />
                        <div className="flex items-center justify-between mt-2">
                          <p className="font-label text-xs text-outline">{selected.quiz.total_submissions} submissions</p>
                          <span className="font-label text-[10px] tracking-wide uppercase px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant">
                            {selected.quiz.avg_score >= 0.75 ? 'On Track' : selected.quiz.avg_score >= 0.5 ? 'Needs Work' : 'Struggling'}
                          </span>
                        </div>
                      </>
                    ) : (
                      <p className="font-label text-sm text-on-surface-variant py-3">No submissions yet</p>
                    )}
                  </div>
                </div>

                {/* Weak areas */}
                {selected.quiz && selected.quiz.question_stats.some((q) => q.avg_correct < 0.6) && (
                  <div className="bg-surface-container-low rounded-lg p-4 mb-5">
                    <p className="font-label text-xs tracking-wide text-on-surface-variant uppercase mb-3">Weak areas — under 60%</p>
                    <ul className="space-y-3">
                      {selected.quiz.question_stats
                        .filter((q) => q.avg_correct < 0.6)
                        .map((q, i) => (
                          <li key={i}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-label text-xs text-on-surface truncate mr-3">{q.question}</span>
                              <span className="font-label text-xs text-on-surface-variant shrink-0">
                                {(q.avg_correct * 100).toFixed(0)}%
                              </span>
                            </div>
                            <ProgressBar value={q.avg_correct} animate={false} />
                          </li>
                        ))}
                    </ul>
                  </div>
                )}

                {/* Student comments */}
                {selected.feedback && selected.feedback.comments.length > 0 && (
                  <div className="mb-5">
                    <p className="font-label text-xs tracking-wide text-on-surface-variant uppercase mb-3">Student Comments</p>
                    <ul className="space-y-2">
                      {selected.feedback.comments.slice(0, 5).map((c, i) => (
                        <li key={i} className="text-sm text-on-surface-variant bg-surface-container-low rounded-lg px-4 py-2.5 italic">
                          &ldquo;{c}&rdquo;
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => router.push(`/course/${id}/lectures/${selected.lecture.lecture_number}`)}
                  className="w-full py-3 bg-primary text-on-primary font-label text-sm font-semibold rounded-full hover:bg-primary-container transition-colors"
                >
                  Open Lecture {selected.lecture.lecture_number} →
                </motion.button>
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  )
}
