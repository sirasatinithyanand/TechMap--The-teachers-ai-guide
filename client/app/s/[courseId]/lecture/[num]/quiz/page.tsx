'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
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
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="w-5 h-5 border-2 border-on-surface-variant border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (phase === 'no-quiz') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface px-4">
        <div className="text-center">
          <p className="font-label text-xs tracking-widest text-on-surface-variant uppercase mb-3">Quiz</p>
          <h1 className="font-headline font-[540] text-2xl tracking-[-0.03em] text-on-surface mb-2">No quiz yet</h1>
          <p className="font-label text-sm text-on-surface-variant">Your professor hasn&apos;t published a quiz for this lecture.</p>
        </div>
      </div>
    )
  }

  if (phase === 'review' && review.length > 0) {
    const item = review[reviewIndex]
    return (
      <div className="min-h-screen bg-surface">
        {/* Header */}
        <div className="bg-surface-container-lowest/80 backdrop-blur border-b border-outline-variant/40 sticky top-0 z-10">
          <div className="px-4 py-3 text-center">
            <div className="inline-flex items-center gap-1.5 bg-surface-container text-on-surface-variant font-label text-xs font-semibold px-3 py-1 rounded-full mb-1">
              Review Answers
            </div>
            <p className="font-label text-xs text-on-surface-variant">{reviewIndex + 1} of {review.length}</p>
          </div>
          <div className="flex justify-center gap-1.5 py-2 px-4">
            {review.map((r, i) => (
              <button
                key={i}
                onClick={() => setReviewIndex(i)}
                className={`h-2 rounded-full transition-all ${
                  i === reviewIndex ? 'w-5 bg-on-surface' : r.is_correct ? 'w-2 bg-surface-container-highest' : 'w-2 bg-outline-variant'
                }`}
              />
            ))}
          </div>
        </div>

        <div className="max-w-md mx-auto px-4 py-6 space-y-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={reviewIndex}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
            >
              <div className={`rounded-lg p-4 mb-4 ${item.is_correct ? 'bg-surface-container-lowest shadow-card' : 'bg-surface-container-low'}`}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="font-label text-xs font-semibold text-on-surface">
                    {item.is_correct ? '✓ Correct' : '✗ Incorrect'}
                  </span>
                  <span className="ml-auto font-label text-xs text-outline">Q{reviewIndex + 1}</span>
                </div>
                <p className="font-headline font-[500] text-sm text-on-surface leading-snug">{item.question}</p>
              </div>

              <div className="space-y-2 mb-4">
                {item.options.map((opt, i) => {
                  const isCorrect = opt === item.correct_answer
                  const isYours = opt === item.your_answer
                  return (
                    <div
                      key={i}
                      className={`w-full px-4 py-3 rounded-lg text-sm font-label flex items-center gap-2.5 ${
                        isCorrect
                          ? 'bg-on-surface text-on-primary'
                          : isYours && !isCorrect
                          ? 'bg-surface-container-high text-on-surface-variant line-through'
                          : 'bg-surface-container-lowest text-on-surface-variant border border-outline-variant/40'
                      }`}
                    >
                      <span className={`shrink-0 w-5 h-5 rounded-full border text-xs flex items-center justify-center font-bold ${
                        isCorrect ? 'border-on-primary text-on-primary' : 'border-outline-variant text-outline'
                      }`}>
                        {String.fromCharCode(65 + i)}
                      </span>
                      <span className="flex-1">{opt}</span>
                    </div>
                  )
                })}
              </div>

              {item.explanation && (
                <div className="bg-surface-container-low rounded-lg p-4 mb-4">
                  <p className="font-label text-xs tracking-wide text-on-surface-variant uppercase mb-1">Explanation</p>
                  <p className="text-sm text-on-surface leading-relaxed">{item.explanation}</p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="flex gap-3">
            {reviewIndex > 0 && (
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={() => setReviewIndex(reviewIndex - 1)}
                className="flex-1 py-3 border border-outline-variant font-label text-xs text-on-surface-variant hover:bg-surface-container rounded-full transition-colors"
              >
                ← Prev
              </motion.button>
            )}
            {reviewIndex < review.length - 1 ? (
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={() => setReviewIndex(reviewIndex + 1)}
                className="flex-1 py-3 bg-primary text-on-primary font-label text-xs font-semibold rounded-full hover:bg-primary-container transition-colors"
              >
                Next →
              </motion.button>
            ) : (
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={() => setPhase('submitted')}
                className="flex-1 py-3 bg-primary text-on-primary font-label text-xs font-semibold rounded-full hover:bg-primary-container transition-colors"
              >
                Back to score
              </motion.button>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (phase === 'submitted' && result) {
    const pct = result.total_mcq ? Math.round((result.correct / result.total_mcq) * 100) : 0
    const msg =
      pct >= 80 ? 'Excellent work!'
      : pct >= 60 ? 'Good effort!'
      : 'Keep reviewing'

    return (
      <div className="min-h-screen flex items-center justify-center bg-surface px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 22 }}
          className="bg-surface-container-lowest rounded-lg shadow-card p-8 text-center max-w-xs w-full"
        >
          <p className="font-label font-bold text-6xl text-on-surface mb-1">{pct}%</p>
          <p className="font-headline font-[500] text-lg text-on-surface">{msg}</p>
          <p className="font-label text-sm text-on-surface-variant mt-2">
            {result.correct} of {result.total_mcq} correct
          </p>
          <div className="mt-5 h-1.5 bg-surface-container rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-on-surface"
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
            />
          </div>
          {review.length > 0 && (
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => { setReviewIndex(0); setPhase('review') }}
              className="mt-5 w-full py-3 border border-outline-variant font-label text-sm font-semibold text-on-surface-variant hover:bg-surface-container rounded-full transition-colors"
            >
              Review Answers →
            </motion.button>
          )}
        </motion.div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-surface">
      {/* Header + progress */}
      <div className="bg-surface-container-lowest/80 backdrop-blur border-b border-outline-variant/40 sticky top-0 z-10">
        <div className="px-4 py-3 text-center">
          <div className="inline-flex items-center gap-1.5 bg-surface-container text-on-surface-variant font-label text-xs font-semibold px-3 py-1 rounded-full mb-1">
            Quiz
          </div>
          <p className="font-label text-xs text-on-surface-variant truncate">{lectureTitle}</p>
        </div>
        <div className="h-1 bg-surface-container">
          <motion.div
            className="h-full bg-on-surface"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>
        <div className="flex justify-center gap-1.5 py-2">
          {questions.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`h-2 rounded-full transition-all ${
                i === current ? 'w-5 bg-on-surface' : answers[i] ? 'w-2 bg-surface-container-highest' : 'w-2 bg-outline-variant'
              }`}
            />
          ))}
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-6">
        <AnimatePresence mode="wait">
          {currentQ && (
            <motion.div
              key={current}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              <div className="bg-surface-container-lowest rounded-lg shadow-card p-5">
                <p className="font-label text-xs text-on-surface-variant mb-2">
                  Question {current + 1} of {questions.length}
                </p>
                <p className="font-headline font-[500] text-base text-on-surface leading-snug">{currentQ.q}</p>
              </div>

              {currentQ.type === 'mcq' && currentQ.options ? (
                <div className="space-y-2">
                  {currentQ.options.map((opt, i) => {
                    const isSelected = currentAnswer === opt
                    return (
                      <motion.button
                        key={i}
                        whileTap={{ scale: 0.99 }}
                        onClick={() => selectAnswer(opt)}
                        className={`w-full text-left px-4 py-3.5 rounded-lg text-sm font-label transition-colors flex items-center gap-2.5 ${
                          isSelected
                            ? 'bg-on-surface text-on-primary'
                            : 'bg-surface-container-lowest border border-outline-variant/40 hover:bg-surface-container-low text-on-surface'
                        }`}
                      >
                        <span className={`shrink-0 w-5 h-5 rounded-full border text-xs flex items-center justify-center font-bold ${
                          isSelected ? 'border-on-primary text-on-primary' : 'border-outline-variant text-outline'
                        }`}>
                          {String.fromCharCode(65 + i)}
                        </span>
                        {opt}
                      </motion.button>
                    )
                  })}
                </div>
              ) : (
                <textarea
                  className="w-full bg-surface-container-lowest border border-outline-variant/40 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-outline resize-none min-h-[100px] text-on-surface placeholder:text-outline"
                  placeholder="Type your answer..."
                  value={answers[current] || ''}
                  onChange={(e) => setAnswers((prev) => prev.map((a, i) => (i === current ? e.target.value : a)))}
                />
              )}

              <div className="flex gap-3 pt-2">
                {current > 0 && (
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setCurrent(current - 1)}
                    className="flex-1 py-3 border border-outline-variant font-label text-xs text-on-surface-variant hover:bg-surface-container rounded-full transition-colors"
                  >
                    ← Back
                  </motion.button>
                )}
                {current < questions.length - 1 ? (
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setCurrent(current + 1)}
                    disabled={!currentAnswer}
                    className="flex-1 py-3 bg-primary text-on-primary font-label text-xs font-semibold rounded-full hover:bg-primary-container disabled:opacity-40 transition-colors"
                  >
                    Next →
                  </motion.button>
                ) : (
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={handleSubmit}
                    disabled={submitting || answers.some((a) => !a)}
                    className="flex-1 py-3 bg-primary text-on-primary font-label text-xs font-semibold rounded-full hover:bg-primary-container disabled:opacity-40 transition-colors"
                  >
                    {submitting ? 'Submitting…' : 'Submit Quiz'}
                  </motion.button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  )
}
