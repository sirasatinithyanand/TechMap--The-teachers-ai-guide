'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ParsedCourse } from '@/lib/api'
import { createCourse } from '@/lib/api'

export default function ConfirmPage() {
  const router = useRouter()
  const [parsed, setParsed] = useState<ParsedCourse | null>(null)
  const [raw, setRaw] = useState('')
  const [professorName, setProfessorName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const p = localStorage.getItem('tm_parsed')
    const r = localStorage.getItem('tm_raw')
    if (!p) { router.push('/'); return }
    setParsed(JSON.parse(p))
    setRaw(r || '')
    const prof = localStorage.getItem('tm_professor')
    if (prof) setProfessorName(JSON.parse(prof).name)
  }, [router])

  async function handleConfirm() {
    if (!parsed) return
    setLoading(true)
    setError('')
    try {
      const course = await createCourse({
        professor_name: professorName.trim() || 'Professor',
        university_name: parsed.university_name,
        course_name: parsed.course_name,
        course_code: parsed.course_code,
        grade_level: parsed.grade_level,
        raw_input: raw,
      })
      localStorage.removeItem('tm_parsed')
      localStorage.removeItem('tm_raw')
      router.push(`/course/${course.id}/curriculum`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create course.')
    } finally {
      setLoading(false)
    }
  }

  if (!parsed) return null

  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Confirm your course</h1>
          <p className="text-gray-500 mt-1">We extracted this from your description</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border p-6 space-y-5">
          {/* Extracted fields */}
          {[
            { label: 'University', value: parsed.university_name },
            { label: 'Course', value: parsed.course_name },
            { label: 'Course Code', value: parsed.course_code || '—' },
            { label: 'Level', value: parsed.grade_level || '—' },
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between items-center py-2 border-b last:border-0">
              <span className="text-sm font-medium text-gray-500">{label}</span>
              <span className="text-sm font-semibold text-gray-900">{value}</span>
            </div>
          ))}

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => router.push('/')}
              className="flex-1 py-2.5 border rounded-xl text-sm font-medium hover:bg-gray-50 transition"
            >
              Back
            </button>
            <button
              onClick={handleConfirm}
              disabled={loading}
              className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition"
            >
              {loading ? 'Creating...' : 'Looks good, continue'}
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}
