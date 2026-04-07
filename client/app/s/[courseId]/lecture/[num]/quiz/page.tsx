'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import type { QuizQuestion, QuizReviewItem } from '@/lib/api'
import { listLectures, getQuiz, submitQuiz } from '@/lib/api'

type Phase = 'loading' | 'ready' | 'submitted' | 'review' | 'no-quiz'

export default function QuizPage() {
  const { courseId, num } = useParams<{ courseId: string; num: string }>()
  const [quizId, setQuizId] = useState<string | null>(null)
  const [lectureTitle, setLectureTitle] = useState('')
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [answers, setAnswers] = useState<(string | null)[]>([])
  const [phase, setPhase] = useState<Phase>('loading')
  const [result, setResult] = useState<{ score: number; correct: number; total_mcq: number } | null>(null)
  const [review, setReview] = useState<QuizReviewItem[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [current, setCurrent] = useState(0)
  const [reviewIndex, setReviewIndex] = useState(0)

  useEffect(() => {
    listLectures(courseId)
      .then(async (lectures) => {
        const lec = lectures.find((l) => l.lecture_number === parseInt(num))
        if (!lec) { setPhase('no-quiz'); return }
        setLectureTitle(lec.title)
        const quiz = await getQuiz(lec.id)
        setQuizId(quiz.id)
        setQuestions(quiz.questions)
        setAnswers(new Array(quiz.questions.length).fill(null))
        setPhase('ready')
      })
      .catch(() => setPhase('no-quiz'))
  }, [courseId, num])

  async function handleSubmit() {
    if (!quizId) return
    setSubmitting(true)
    try {
      const res = await submitQuiz(quizId, answers.map((a) => a ?? ''))
      setResult(res)
      setReview(res.review || [])
      setPhase('submitted')
    } finally {
      setSubmitting(false)
    }
  }

  function selectAnswer(ans: string) {
    setAnswers((prev) => prev.map((a, i) => (i === current ? ans : a)))
  }

  const answered = answers.filter(Boolean).length
  const progress = questions.length ? (answered / questions.length) * 100 : 0
  const currentQ = questions[current]
  const currentAnswer = answers[current]

  if (phase === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-white">
        <div className="w-6 h-6 border-4 border-blue-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (phase === 'no-quiz') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-white px-4">
        <div className="text-center">
          <p className="text-5xl mb-4">📭</p>
          <p className="text-xl font-bold text-gray-700">No quiz yet</p>
          <p className="text-gray-400 text-sm mt-1">Your professor hasn't published a quiz for this lecture.</p>
        </div>
      </div>
    )
  }

  if (phase === 'review' && review.length > 0) {
    const item = review[reviewIndex]
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        {/* Header */}
        <div className="bg-white border-b sticky top-0 z-10 shadow-sm">
          <div className="px-4 py-3 text-center">
            <div className="inline-flex items-center gap-1.5 bg-blue-100 text-blue-700 text-xs font-semibold px-3 py-1 rounded-full mb-1">
              🔍 Review Answers
            </div>
            <p className="text-xs text-gray-500">{reviewIndex + 1} of {review.length}</p>
          </div>
          <div className="flex justify-center gap-1.5 py-2 px-4">
            {review.map((r, i) => (
              <button
                key={i}
                onClick={() => setReviewIndex(i)}
                className={`w-2.5 h-2.5 rounded-full transition-all ${
                  i === reviewIndex
                    ? 'w-5 ' + (r.is_correct ? 'bg-green-500' : 'bg-red-400')
                    : r.is_correct ? 'bg-green-300' : 'bg-red-200'
                }`}
              />
            ))}
          </div>
        </div>

        <div className="max-w-md mx-auto px-4 py-6 space-y-4">
          {/* Result badge */}
          <div className={`rounded-2xl p-4 border-2 ${item.is_correct ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">{item.is_correct ? '✅' : '❌'}</span>
              <span className={`text-sm font-bold ${item.is_correct ? 'text-green-700' : 'text-red-600'}`}>
                {item.is_correct ? 'Correct!' : 'Incorrect'}
              </span>
              <span className="ml-auto text-xs text-gray-400">Q{reviewIndex + 1}</span>
            </div>
            <p className="text-sm font-semibold text-gray-800 leading-snug">{item.question}</p>
          </div>

          {/* Options */}
          <div className="space-y-2">
            {item.options.map((opt, i) => {
              const isCorrect = opt === item.correct_answer
              const isYours = opt === item.your_answer
              const base = 'w-full text-left px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all flex items-center gap-2.5'
              let cls = base
              if (isCorrect) cls += ' border-green-400 bg-green-50 text-green-800'
              else if (isYours && !isCorrect) cls += ' border-red-300 bg-red-50 text-red-700'
              else cls += ' border-gray-200 bg-white text-gray-500'
              return (
                <div key={i} className={cls}>
                  <span className={`shrink-0 w-6 h-6 rounded-full border-2 text-xs flex items-center justify-center font-bold ${
                    isCorrect ? 'border-green-400 bg-green-400 text-white'
                    : isYours ? 'border-red-300 bg-red-300 text-white'
                    : 'border-gray-300 text-gray-400'
                  }`}>
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span className="flex-1">{opt}</span>
                  {isCorrect && <span className="text-green-500 text-base">✓</span>}
                  {isYours && !isCorrect && <span className="text-red-400 text-base">✗</span>}
                </div>
              )
            })}
          </div>

          {/* Explanation */}
          {item.explanation && (
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
              <p className="text-xs font-semibold text-blue-600 mb-1">💡 Explanation</p>
              <p className="text-sm text-blue-800 leading-relaxed">{item.explanation}</p>
            </div>
          )}

          {/* Navigation */}
          <div className="flex gap-3 pt-2">
            {reviewIndex > 0 && (
              <button
                onClick={() => setReviewIndex(reviewIndex - 1)}
                className="flex-1 py-3 border-2 border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:border-gray-300"
              >
                ← Prev
              </button>
            )}
            {reviewIndex < review.length - 1 ? (
              <button
                onClick={() => setReviewIndex(reviewIndex + 1)}
                className="flex-1 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl text-sm font-semibold hover:opacity-90 transition"
              >
                Next →
              </button>
            ) : (
              <button
                onClick={() => setPhase('submitted')}
                className="flex-1 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl text-sm font-semibold hover:opacity-90 transition"
              >
                Back to score
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (phase === 'submitted' && result) {
    const pct = result.total_mcq ? Math.round((result.correct / result.total_mcq) * 100) : 0
    const { emoji, msg, bg } =
      pct >= 80 ? { emoji: '🎉', msg: 'Excellent!', bg: 'from-green-400 to-emerald-500' }
      : pct >= 60 ? { emoji: '👍', msg: 'Good effort!', bg: 'from-blue-400 to-indigo-500' }
      : { emoji: '📖', msg: 'Keep reviewing', bg: 'from-amber-400 to-orange-500' }

    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-white px-4">
        <div className="bg-white rounded-3xl shadow-lg border p-8 text-center max-w-xs w-full">
          <div className={`w-24 h-24 rounded-full bg-gradient-to-br ${bg} flex items-center justify-center mx-auto mb-4 shadow-lg`}>
            <span className="text-4xl">{emoji}</span>
          </div>
          <p className="text-5xl font-black text-gray-900 mb-1">{pct}%</p>
          <p className="text-lg font-semibold text-gray-600">{msg}</p>
          <p className="text-sm text-gray-400 mt-2">
            {result.correct} of {result.total_mcq} correct
          </p>
          <div className="mt-5 h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full bg-gradient-to-r ${bg} transition-all duration-1000`}
              style={{ width: `${pct}%` }}
            />
          </div>
          {review.length > 0 && (
            <button
              onClick={() => { setReviewIndex(0); setPhase('review') }}
              className="mt-5 w-full py-3 border-2 border-blue-200 text-blue-600 rounded-2xl text-sm font-semibold hover:bg-blue-50 transition"
            >
              Review Answers →
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Header + progress */}
      <div className="bg-white border-b sticky top-0 z-10 shadow-sm">
        <div className="px-4 py-3 text-center">
          <div className="inline-flex items-center gap-1.5 bg-blue-100 text-blue-700 text-xs font-semibold px-3 py-1 rounded-full mb-1">
            📝 Quiz
          </div>
          <p className="text-xs text-gray-500 truncate">{lectureTitle}</p>
        </div>
        <div className="h-1.5 bg-gray-100">
          <div
            className="h-full bg-gradient-to-r from-blue-400 to-indigo-500 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-center gap-2 py-2">
          {questions.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`w-2.5 h-2.5 rounded-full transition-all ${
                i === current
                  ? 'bg-blue-500 w-5'
                  : answers[i]
                  ? 'bg-blue-300'
                  : 'bg-gray-200'
              }`}
            />
          ))}
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-6">
        {currentQ && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border shadow-sm p-5">
              <p className="text-xs text-blue-500 font-semibold mb-2">
                Question {current + 1} of {questions.length}
              </p>
              <p className="text-base font-semibold text-gray-800 leading-snug">{currentQ.q}</p>
            </div>

            {currentQ.type === 'mcq' && currentQ.options ? (
              <div className="space-y-2.5">
                {currentQ.options.map((opt, i) => {
                  const isSelected = currentAnswer === opt
                  return (
                    <button
                      key={i}
                      onClick={() => selectAnswer(opt)}
                      className={`w-full text-left px-4 py-3.5 rounded-xl border-2 text-sm font-medium transition-all ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                          : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50 text-gray-700'
                      }`}
                    >
                      <span className={`inline-flex w-6 h-6 rounded-full border-2 text-xs items-center justify-center mr-2.5 shrink-0 ${
                        isSelected ? 'border-blue-500 bg-blue-500 text-white' : 'border-gray-300 text-gray-400'
                      }`}>
                        {String.fromCharCode(65 + i)}
                      </span>
                      {opt}
                    </button>
                  )
                })}
              </div>
            ) : (
              <textarea
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-400 resize-none min-h-[100px] bg-white"
                placeholder="Type your answer..."
                value={answers[current] || ''}
                onChange={(e) => setAnswers((prev) => prev.map((a, i) => (i === current ? e.target.value : a)))}
              />
            )}

            <div className="flex gap-3 pt-2">
              {current > 0 && (
                <button
                  onClick={() => setCurrent(current - 1)}
                  className="flex-1 py-3 border-2 border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:border-gray-300"
                >
                  ← Back
                </button>
              )}
              {current < questions.length - 1 ? (
                <button
                  onClick={() => setCurrent(current + 1)}
                  disabled={!currentAnswer}
                  className="flex-1 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl text-sm font-semibold disabled:opacity-40 hover:opacity-90 transition"
                >
                  Next →
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={submitting || answers.some((a) => !a)}
                  className="flex-1 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl text-sm font-semibold disabled:opacity-40 hover:opacity-90 transition"
                >
                  {submitting ? 'Submitting...' : 'Submit Quiz ✓'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
