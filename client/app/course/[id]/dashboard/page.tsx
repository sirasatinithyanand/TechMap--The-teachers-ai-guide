'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
      <header className="bg-white/80 backdrop-blur border-b px-6 py-4 flex items-center justify-between">
        <div className="space-y-1.5">
          <SkeletonBlock className="h-5 w-48" />
          <SkeletonBlock className="h-3.5 w-32" />
        </div>
      </header>
      <div className="max-w-6xl mx-auto px-6 py-6 grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border p-5 space-y-3">
            <SkeletonBlock className="h-3.5 w-20" />
            <SkeletonBlock className="h-8 w-16" />
          </div>
        ))}
      </div>
      <div className="max-w-6xl mx-auto px-6 pb-8 grid grid-cols-3 gap-6">
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border p-4 space-y-2">
              <SkeletonBlock className="h-4 w-3/4" />
              <SkeletonBlock className="h-3 w-1/2" />
            </div>
          ))}
        </div>
        <div className="col-span-2">
          <div className="bg-white rounded-2xl border p-6 space-y-4">
            <SkeletonBlock className="h-6 w-56" />
            <div className="grid grid-cols-2 gap-4">
              <div className="border rounded-xl p-4 space-y-3">
                <SkeletonBlock className="h-4 w-24" />
                <SkeletonBlock className="h-10 w-16" />
                <SkeletonBlock className="h-2 w-full rounded-full" />
              </div>
              <div className="border rounded-xl p-4 space-y-3">
                <SkeletonBlock className="h-4 w-24" />
                <SkeletonBlock className="h-10 w-16" />
                <SkeletonBlock className="h-2 w-full rounded-full" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function RatingStars({ rating, max = 5 }: { rating: number; max?: number }) {
  return (
    <div className="flex gap-0.5">
      {[...Array(max)].map((_, i) => {
        const filled = i < Math.floor(rating)
        const partial = !filled && i < rating
        return (
          <span
            key={i}
            className={`text-base leading-none ${filled ? 'text-amber-400' : partial ? 'text-amber-200' : 'text-gray-200'}`}
          >
            ★
          </span>
        )
      })}
    </div>
  )
}

function ProgressBar({
  value,
  color = 'indigo',
  animate = true,
}: {
  value: number // 0–1
  color?: 'indigo' | 'emerald' | 'amber' | 'red'
  animate?: boolean
}) {
  const [width, setWidth] = useState(0)
  useEffect(() => {
    if (animate) {
      const t = setTimeout(() => setWidth(value), 100)
      return () => clearTimeout(t)
    }
    setWidth(value)
  }, [value, animate])

  const colorMap = {
    indigo: 'bg-indigo-500',
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-400',
    red: 'bg-red-400',
  }

  return (
    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-700 ease-out ${colorMap[color]}`}
        style={{ width: `${Math.round(width * 100)}%` }}
      />
    </div>
  )
}

function scoreColor(score: number): 'emerald' | 'amber' | 'red' {
  if (score >= 0.75) return 'emerald'
  if (score >= 0.5) return 'amber'
  return 'red'
}

function ratingColor(rating: number): 'emerald' | 'amber' | 'red' {
  if (rating >= 4) return 'emerald'
  if (rating >= 2.5) return 'amber'
  return 'red'
}

const STAT_ICONS = ['📚', '⭐', '💬', '🎯']
const STAT_GRADIENTS = [
  'from-indigo-500 to-purple-600',
  'from-amber-400 to-orange-500',
  'from-sky-500 to-cyan-600',
  'from-emerald-500 to-teal-600',
]

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
    { label: 'Lectures', value: summaries.length, suffix: '' },
    { label: 'Avg Rating', value: avgRating ? avgRating.toFixed(1) : '—', suffix: avgRating ? ' / 5' : '' },
    { label: 'Total Questions', value: totalQuestions, suffix: '' },
    { label: 'Avg Quiz Score', value: avgQuiz ? `${(avgQuiz * 100).toFixed(0)}` : '—', suffix: avgQuiz ? '%' : '' },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div>
          <h1 className="text-lg font-bold text-gray-900">{course?.course_name}</h1>
          <p className="text-xs text-gray-400 mt-0.5">{course?.university_name} · Professor Dashboard</p>
        </div>
        <button
          onClick={() => router.push(`/course/${id}/lectures`)}
          className="text-sm text-indigo-600 hover:text-indigo-800 font-medium transition flex items-center gap-1"
        >
          ← Lectures
        </button>
      </header>

      {/* Stat cards */}
      <div className="max-w-6xl mx-auto px-6 py-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map(({ label, value, suffix }, i) => (
          <div
            key={label}
            className="bg-white rounded-2xl border shadow-sm p-5 overflow-hidden relative group hover:shadow-md transition animate-fade-in"
            style={{ animationDelay: `${i * 0.07}s` }}
          >
            {/* Gradient top bar */}
            <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${STAT_GRADIENTS[i]} rounded-t-2xl`} />
            <div className="flex items-start justify-between mb-2">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</p>
              <span className="text-lg opacity-60 group-hover:opacity-100 transition">{STAT_ICONS[i]}</span>
            </div>
            <p className="text-3xl font-black text-gray-900">
              {value}
              <span className="text-base font-semibold text-gray-400">{suffix}</span>
            </p>
          </div>
        ))}
      </div>

      {/* Main 3-col layout */}
      <div className="max-w-6xl mx-auto px-6 pb-10 grid grid-cols-3 gap-6">

        {/* Lecture list */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-1">Lectures</p>
          {summaries.map((s, i) => {
            const isSelected = selected?.lecture.id === s.lecture.id
            const rating = s.feedback?.avg_rating
            const quizScore = s.quiz?.avg_score
            return (
              <button
                key={s.lecture.id}
                onClick={() => setSelected(s)}
                className={`w-full text-left px-4 py-3 rounded-xl border transition-all duration-200 animate-fade-in ${
                  isSelected
                    ? 'border-indigo-400 bg-indigo-50 shadow-sm shadow-indigo-100'
                    : 'bg-white hover:border-indigo-200 hover:shadow-sm'
                }`}
                style={{ animationDelay: `${0.1 + i * 0.04}s` }}
              >
                <div className="flex items-start gap-3">
                  {/* Number badge */}
                  <span
                    className={`text-xs font-bold w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                      isSelected ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {s.lecture.lecture_number}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${isSelected ? 'text-indigo-800' : 'text-gray-800'}`}>
                      {s.lecture.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      {rating ? (
                        <span className="text-[10px] text-amber-500 font-semibold">★ {rating.toFixed(1)}</span>
                      ) : null}
                      {quizScore != null ? (
                        <span
                          className={`text-[10px] font-semibold ${
                            quizScore >= 0.75 ? 'text-emerald-600' : quizScore >= 0.5 ? 'text-amber-600' : 'text-red-500'
                          }`}
                        >
                          Quiz {(quizScore * 100).toFixed(0)}%
                        </span>
                      ) : null}
                      {!rating && quizScore == null && (
                        <span className="text-[10px] text-gray-300">No data yet</span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="col-span-2 space-y-4 animate-fade-in">
            <div className="bg-white rounded-2xl border shadow-sm p-6">
              {/* Lecture title */}
              <h2 className="font-bold text-gray-900 text-lg mb-1">
                Lecture {selected.lecture.lecture_number}: {selected.lecture.title}
              </h2>
              <p className="text-xs text-gray-400 mb-5">
                {selected.questionCount} student question{selected.questionCount !== 1 ? 's' : ''} ·{' '}
                {selected.feedback?.total_responses || 0} feedback response{(selected.feedback?.total_responses || 0) !== 1 ? 's' : ''}
              </p>

              {/* Metrics row */}
              <div className="grid grid-cols-2 gap-4 mb-5">
                {/* Feedback card */}
                <div className="border rounded-xl p-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Student Feedback</p>
                  {selected.feedback && selected.feedback.total_responses > 0 ? (
                    <>
                      <div className="flex items-end gap-2 mb-2">
                        <p className="text-4xl font-black text-gray-900">
                          {selected.feedback.avg_rating.toFixed(1)}
                        </p>
                        <p className="text-sm text-gray-400 mb-1.5">/ 5</p>
                      </div>
                      <RatingStars rating={selected.feedback.avg_rating} />
                      <div className="mt-3">
                        <ProgressBar value={selected.feedback.avg_rating / 5} color={ratingColor(selected.feedback.avg_rating)} />
                      </div>
                      <p className="text-[11px] text-gray-400 mt-2">
                        {selected.feedback.total_responses} responses
                      </p>
                    </>
                  ) : (
                    <div className="py-4 text-center">
                      <p className="text-2xl mb-1">🕊️</p>
                      <p className="text-sm text-gray-400">No feedback yet</p>
                    </div>
                  )}
                </div>

                {/* Quiz card */}
                <div className="border rounded-xl p-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Quiz Results</p>
                  {selected.quiz && selected.quiz.total_submissions > 0 ? (
                    <>
                      <div className="flex items-end gap-1 mb-2">
                        <p className="text-4xl font-black text-gray-900">
                          {(selected.quiz.avg_score * 100).toFixed(0)}
                        </p>
                        <p className="text-sm text-gray-400 mb-1.5">%</p>
                      </div>
                      <div className="mt-1">
                        <ProgressBar value={selected.quiz.avg_score} color={scoreColor(selected.quiz.avg_score)} />
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <p className="text-[11px] text-gray-400">{selected.quiz.total_submissions} submissions</p>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                            selected.quiz.avg_score >= 0.75
                              ? 'bg-emerald-100 text-emerald-700'
                              : selected.quiz.avg_score >= 0.5
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-red-100 text-red-600'
                          }`}
                        >
                          {selected.quiz.avg_score >= 0.75 ? 'On Track' : selected.quiz.avg_score >= 0.5 ? 'Needs Work' : 'Struggling'}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="py-4 text-center">
                      <p className="text-2xl mb-1">📋</p>
                      <p className="text-sm text-gray-400">No submissions yet</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Weak areas */}
              {selected.quiz && selected.quiz.question_stats.some((q) => q.avg_correct < 0.6) && (
                <div className="bg-red-50 border border-red-100 rounded-xl p-4 mb-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-base">⚠️</span>
                    <p className="text-sm font-semibold text-red-700">Weak areas — under 60%</p>
                  </div>
                  <ul className="space-y-2">
                    {selected.quiz.question_stats
                      .filter((q) => q.avg_correct < 0.6)
                      .map((q, i) => (
                        <li key={i} className="text-sm">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-red-700 truncate mr-3 font-medium">{q.question}</span>
                            <span className="shrink-0 text-xs font-bold text-red-500">
                              {(q.avg_correct * 100).toFixed(0)}%
                            </span>
                          </div>
                          <ProgressBar value={q.avg_correct} color="red" animate={false} />
                        </li>
                      ))}
                  </ul>
                </div>
              )}

              {/* Student comments */}
              {selected.feedback && selected.feedback.comments.length > 0 && (
                <div className="mb-5">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Student Comments</p>
                  <ul className="space-y-2">
                    {selected.feedback.comments.slice(0, 5).map((c, i) => (
                      <li
                        key={i}
                        className="text-sm text-gray-600 bg-gray-50 rounded-xl px-4 py-2.5 italic border border-gray-100 flex gap-2"
                      >
                        <span className="text-gray-300 shrink-0">"</span>
                        {c}
                        <span className="text-gray-300 shrink-0 self-end">"</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <button
                onClick={() => router.push(`/course/${id}/lectures/${selected.lecture.lecture_number}`)}
                className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl text-sm font-semibold hover:from-indigo-700 hover:to-purple-700 transition shadow-sm hover:shadow-md"
              >
                Prepare Next Lecture →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
