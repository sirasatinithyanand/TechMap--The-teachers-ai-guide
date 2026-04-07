'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { parseCourse, getProfessorCourses } from '@/lib/api'
import type { Course } from '@/lib/api'

interface Professor {
  id: string
  name: string
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

  function handleLogout() {
    localStorage.removeItem('tm_professor')
    router.push('/login')
  }

  if (!professor) return null

  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 px-4 py-10">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">TeachMap</h1>
            <p className="text-sm text-gray-500 mt-0.5">Welcome back, {professor.name}</p>
          </div>
          <button
            onClick={handleLogout}
            className="text-xs text-gray-400 hover:text-gray-600 transition"
          >
            Log out
          </button>
        </div>

        {/* New course input */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border p-6 space-y-4 mb-8">
          <h2 className="text-sm font-semibold text-gray-700">Start a new course</h2>
          <textarea
            className="w-full border rounded-xl px-4 py-3 text-base resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[80px]"
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
            className="w-full py-3 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-700 disabled:opacity-50 transition"
          >
            {loading ? 'Analysing...' : 'Build My Curriculum'}
          </button>
        </form>

        {/* My Courses */}
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">My Courses</h2>
          {loadingCourses ? (
            <div className="flex justify-center py-8">
              <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : courses.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm border border-dashed rounded-2xl">
              No courses yet — create your first one above.
            </div>
          ) : (
            <div className="space-y-3">
              {courses.map((c) => (
                <button
                  key={c.id}
                  onClick={() => router.push(`/course/${c.id}/dashboard`)}
                  className="w-full text-left bg-white border rounded-2xl px-5 py-4 shadow-sm hover:shadow-md hover:border-indigo-200 transition group"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-gray-900 group-hover:text-indigo-700 transition">{c.course_name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {c.university_name}{c.course_code ? ` · ${c.course_code}` : ''}{c.grade_level ? ` · ${c.grade_level}` : ''}
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      c.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {c.status}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
