'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 via-white to-orange-50 px-4">
        <div className="text-center">
          <div className="text-7xl mb-5 animate-bounce">🙏</div>
          <h1 className="text-2xl font-bold text-gray-900">Thanks for your feedback!</h1>
          <p className="text-gray-400 mt-2 text-sm max-w-xs mx-auto">
            Your professor will use this to make the next lecture even better.
          </p>
          <div className="mt-6 inline-flex items-center gap-2 bg-amber-100 text-amber-700 text-sm font-medium px-4 py-2 rounded-full">
            ⭐ Rating submitted
          </div>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-700 text-xs font-semibold px-3 py-1 rounded-full mb-3">
            ⭐ Class Feedback
          </div>
          <h1 className="text-2xl font-bold text-gray-900">How was today's class?</h1>
          {lectureTitle && <p className="text-gray-400 text-sm mt-1">{lectureTitle}</p>}
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-3xl shadow-sm border p-6 space-y-6">
          {/* Emoji rating */}
          <div>
            <p className="text-sm font-medium text-gray-600 text-center mb-4">Tap to rate</p>
            <div className="flex justify-center gap-3">
              {RATINGS.map(({ value, emoji }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRating(value)}
                  onMouseEnter={() => setHovered(value)}
                  onMouseLeave={() => setHovered(null)}
                  className={`flex flex-col items-center transition-all duration-150 ${
                    active === value ? 'scale-125' : 'scale-100 opacity-50 hover:opacity-80'
                  }`}
                >
                  <span className="text-3xl">{emoji}</span>
                  {active === value && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1" />
                  )}
                </button>
              ))}
            </div>

            {/* Label */}
            <div className="h-7 flex items-center justify-center mt-3">
              {activeRating && (
                <p className="text-sm font-semibold text-amber-600 animate-pulse">
                  {activeRating.label}
                </p>
              )}
            </div>
          </div>

          {/* Comment */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Any thoughts? <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              className="w-full border-2 border-gray-100 rounded-2xl px-4 py-3 text-sm resize-none focus:outline-none focus:border-amber-300 min-h-[90px] bg-gray-50"
              placeholder="What clicked? What didn't? Your prof wants to know..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={!rating || submitting}
            className="w-full py-3.5 bg-gradient-to-r from-amber-400 to-orange-500 text-white rounded-2xl font-bold text-sm hover:opacity-90 disabled:opacity-40 transition shadow-sm"
          >
            {submitting ? 'Submitting...' : 'Submit Feedback ✓'}
          </button>
        </form>
      </div>
    </main>
  )
}
