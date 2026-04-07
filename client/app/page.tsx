'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { parseCourse } from '@/lib/api'

export default function LandingPage() {
  const router = useRouter()
  const [sentence, setSentence] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <div className="w-full max-w-2xl">
        {/* Logo */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-gray-900 tracking-tight">TeachMap</h1>
          <p className="mt-2 text-gray-500 text-lg">Describe your course in one sentence.</p>
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border p-6 space-y-4">
          <textarea
            className="w-full border rounded-xl px-4 py-3 text-base resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[100px]"
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
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading || !sentence.trim()}
            className="w-full py-3 bg-indigo-600 text-white rounded-xl font-semibold text-base hover:bg-indigo-700 disabled:opacity-50 transition"
          >
            {loading ? 'Analysing...' : 'Build My Curriculum'}
          </button>
        </form>

        <p className="text-center mt-4 text-sm text-gray-400">
          Powered by CurricuLLM · Gemini · Mapbox
        </p>
      </div>
    </main>
  )
}
