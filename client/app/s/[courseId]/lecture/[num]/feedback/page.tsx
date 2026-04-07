'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { listLectures, submitFeedback } from '@/lib/api'

const RATINGS = [
  { value: 1, emoji: '😞', label: 'Not helpful' },
  { value: 2, emoji: '😕', label: 'Could be better' },
  { value: 3, emoji: '😊', label: 'It was okay' },
  { value: 4, emoji: '😄', label: 'Pretty good!' },
  { value: 5, emoji: '🤩', label: 'Excellent!' },
]

export default function FeedbackPage() {
  const { courseId, num } = useParams<{ courseId: string; num: string }>()
  const [lectureId, setLectureId] = useState<string | null>(null)
  const [lectureTitle, setLectureTitle] = useState('')
  const [rating, setRating] = useState<number | null>(null)
  const [hovered, setHovered] = useState<number | null>(null)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    listLectures(courseId).then((lectures) => {
      const lec = lectures.find((l) => l.lecture_number === parseInt(num))
      if (lec) { setLectureId(lec.id); setLectureTitle(lec.title) }
    })
  }, [courseId, num])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!rating || !lectureId) return
    setSubmitting(true)
    try {
      await submitFeedback(lectureId, rating, comment.trim() || undefined)
      setDone(true)
    } finally {
      setSubmitting(false)
    }
  }

  const active = hovered ?? rating
  const activeRating = RATINGS.find((r) => r.value === active)

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 22 }}
          className="text-center"
        >
          <div className="text-6xl mb-5">🙏</div>
          <h1 className="font-headline font-[540] text-2xl tracking-[-0.03em] text-on-surface mb-2">
            Thanks for your feedback!
          </h1>
          <p className="font-label text-sm text-on-surface-variant max-w-xs mx-auto">
            Your professor will use this to improve the next lecture.
          </p>
          <div className="mt-6 inline-flex items-center gap-2 bg-surface-container text-on-surface-variant font-label text-sm font-medium px-4 py-2 rounded-full">
            Rating submitted
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-surface flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-1.5 bg-surface-container text-on-surface-variant font-label text-xs font-semibold px-3 py-1 rounded-full mb-3">
            Class Feedback
          </div>
          <h1 className="font-headline font-[540] text-2xl tracking-[-0.03em] text-on-surface">
            How was today&apos;s class?
          </h1>
          {lectureTitle && (
            <p className="font-label text-sm text-on-surface-variant mt-1">{lectureTitle}</p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="bg-surface-container-lowest rounded-lg shadow-card p-6 space-y-6">
          {/* Emoji rating */}
          <div>
            <p className="font-label text-xs text-on-surface-variant text-center mb-4">Tap to rate</p>
            <div className="flex justify-center gap-3">
              {RATINGS.map(({ value, emoji }) => (
                <motion.button
                  key={value}
                  type="button"
                  onClick={() => setRating(value)}
                  onMouseEnter={() => setHovered(value)}
                  onMouseLeave={() => setHovered(null)}
                  whileTap={{ scale: 0.9 }}
                  animate={{ scale: active === value ? 1.25 : 1, opacity: active === value ? 1 : 0.5 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  className="flex flex-col items-center"
                >
                  <span className="text-3xl">{emoji}</span>
                  {active === value && (
                    <motion.span
                      layoutId="rating-dot"
                      className="w-1.5 h-1.5 rounded-full bg-on-surface mt-1"
                    />
                  )}
                </motion.button>
              ))}
            </div>

            <div className="h-7 flex items-center justify-center mt-3">
              <AnimatePresence mode="wait">
                {activeRating && (
                  <motion.p
                    key={activeRating.value}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15 }}
                    className="font-label text-sm font-semibold text-on-surface"
                  >
                    {activeRating.label}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Comment */}
          <div>
            <label className="font-label text-xs tracking-wide text-on-surface-variant uppercase block mb-2">
              Any thoughts? <span className="normal-case text-outline">(optional)</span>
            </label>
            <textarea
              className="w-full bg-surface-container-low rounded-lg px-4 py-3 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-outline min-h-[90px] text-on-surface placeholder:text-outline"
              placeholder="What clicked? What didn't?"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>

          <motion.button
            type="submit"
            disabled={!rating || submitting}
            whileTap={{ scale: 0.98 }}
            className="w-full py-3.5 bg-primary text-on-primary font-label text-sm font-semibold rounded-full hover:bg-primary-container disabled:opacity-40 transition-colors"
          >
            {submitting ? 'Submitting…' : 'Submit Feedback'}
          </motion.button>
        </form>
      </div>
    </main>
  )
}
