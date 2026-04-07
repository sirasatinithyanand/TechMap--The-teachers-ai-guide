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

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading dashboard...</div>

  const avgRating =
    summaries.filter((s) => s.feedback?.avg_rating).reduce((acc, s) => acc + (s.feedback?.avg_rating || 0), 0) /
      (summaries.filter((s) => s.feedback?.avg_rating).length || 1)

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">{course?.course_name} — Dashboard</h1>
          <p className="text-sm text-gray-500">{course?.university_name}</p>
        </div>
        <button
          onClick={() => router.push(`/course/${id}/lectures`)}
          className="text-sm text-indigo-600 hover:underline"
        >
          ← Lectures
        </button>
      </header>

      {/* Top stats */}
      <div className="max-w-6xl mx-auto px-6 py-6 grid grid-cols-4 gap-4">
        {[
          { label: 'Lectures', value: summaries.length },
          { label: 'Avg Rating', value: avgRating ? `${avgRating.toFixed(1)} / 5` : '—' },
          { label: 'Total Questions', value: summaries.reduce((a, s) => a + s.questionCount, 0) },
          {
            label: 'Avg Quiz Score',
            value:
              summaries.filter((s) => s.quiz).length
                ? `${(summaries.filter((s) => s.quiz).reduce((a, s) => a + (s.quiz?.avg_score || 0), 0) / summaries.filter((s) => s.quiz).length * 100).toFixed(0)}%`
                : '—',
          },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white rounded-xl border p-5">
            <p className="text-sm text-gray-500">{label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          </div>
        ))}
      </div>

      <div className="max-w-6xl mx-auto px-6 pb-8 grid grid-cols-3 gap-6">
        {/* Lecture list */}
        <div className="space-y-2">
          {summaries.map((s) => (
            <button
              key={s.lecture.id}
              onClick={() => setSelected(s)}
              className={`w-full text-left px-4 py-3 rounded-xl border transition ${
                selected?.lecture.id === s.lecture.id
                  ? 'border-indigo-400 bg-indigo-50'
                  : 'bg-white hover:border-indigo-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-800 truncate">
                  {s.lecture.lecture_number}. {s.lecture.title}
                </p>
                {s.feedback?.avg_rating ? (
                  <span className="text-xs text-amber-500 shrink-0 ml-2">
                    {'★'.repeat(Math.round(s.feedback.avg_rating))} {s.feedback.avg_rating.toFixed(1)}
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                {s.questionCount} questions · {s.feedback?.total_responses || 0} feedback
              </p>
            </button>
          ))}
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="col-span-2 space-y-4">
            <div className="bg-white rounded-xl border p-5">
              <h2 className="font-semibold text-gray-900 mb-4">
                Lecture {selected.lecture.lecture_number}: {selected.lecture.title}
              </h2>

              <div className="grid grid-cols-2 gap-4 mb-4">
                {/* Feedback */}
                <div className="border rounded-lg p-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">Student Feedback</p>
                  {selected.feedback && selected.feedback.total_responses > 0 ? (
                    <>
                      <p className="text-2xl font-bold text-gray-900">
                        {selected.feedback.avg_rating.toFixed(1)}<span className="text-sm text-gray-400"> / 5</span>
                      </p>
                      <p className="text-xs text-gray-400 mt-1">{selected.feedback.total_responses} responses</p>
                    </>
                  ) : (
                    <p className="text-sm text-gray-400">No feedback yet</p>
                  )}
                </div>

                {/* Quiz */}
                <div className="border rounded-lg p-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">Quiz Results</p>
                  {selected.quiz && selected.quiz.total_submissions > 0 ? (
                    <>
                      <p className="text-2xl font-bold text-gray-900">
                        {(selected.quiz.avg_score * 100).toFixed(0)}<span className="text-sm text-gray-400">%</span>
                      </p>
                      <p className="text-xs text-gray-400 mt-1">{selected.quiz.total_submissions} submissions</p>
                    </>
                  ) : (
                    <p className="text-sm text-gray-400">No submissions yet</p>
                  )}
                </div>
              </div>

              {/* Weak areas from quiz */}
              {selected.quiz && selected.quiz.question_stats.some((q) => q.avg_correct < 0.6) && (
                <div className="bg-red-50 rounded-lg p-3 mb-4">
                  <p className="text-sm font-medium text-red-700 mb-2">Weak areas (under 60%)</p>
                  <ul className="space-y-1">
                    {selected.quiz.question_stats
                      .filter((q) => q.avg_correct < 0.6)
                      .map((q, i) => (
                        <li key={i} className="text-sm text-red-600 flex justify-between">
                          <span className="truncate mr-2">{q.question}</span>
                          <span className="shrink-0 text-xs">{(q.avg_correct * 100).toFixed(0)}%</span>
                        </li>
                      ))}
                  </ul>
                </div>
              )}

              {/* Feedback comments */}
              {selected.feedback && selected.feedback.comments.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Student comments</p>
                  <ul className="space-y-2">
                    {selected.feedback.comments.slice(0, 5).map((c, i) => (
                      <li key={i} className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2 italic">
                        "{c}"
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <button
                onClick={() => router.push(`/course/${id}/lectures/${selected.lecture.lecture_number}`)}
                className="mt-4 w-full py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
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
