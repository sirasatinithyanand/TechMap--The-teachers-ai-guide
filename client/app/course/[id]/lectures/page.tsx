'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import type { Course, Lecture } from '@/lib/api'
import { getCourse, listLectures, exportLectures } from '@/lib/api'

export default function LecturesPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [course, setCourse] = useState<Course | null>(null)
  const [lectures, setLectures] = useState<Lecture[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getCourse(id), listLectures(id)])
      .then(([c, l]) => { setCourse(c); setLectures(l) })
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading lectures...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">{course?.course_name}</h1>
          <p className="text-sm text-gray-500">{course?.university_name} · {lectures.length} lectures</p>
        </div>
        <div className="flex gap-3">
          <a
            href={exportLectures(id)}
            className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50 flex items-center gap-1.5"
            download
          >
            Export ZIP
          </a>
          <button
            onClick={() => router.push(`/course/${id}/dashboard`)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700"
          >
            Dashboard
          </button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-3">
        {lectures.map((lec) => (
          <div
            key={lec.id}
            onClick={() => router.push(`/course/${id}/lectures/${lec.lecture_number}`)}
            className="bg-white rounded-xl border p-5 cursor-pointer hover:border-indigo-300 hover:shadow-sm transition group"
          >
            <div className="flex items-start justify-between">
              <div className="flex gap-3">
                <span className="text-2xl font-bold text-indigo-200 group-hover:text-indigo-300 transition w-8 shrink-0">
                  {lec.lecture_number}
                </span>
                <div>
                  <h2 className="font-semibold text-gray-900 group-hover:text-indigo-600 transition">
                    {lec.title}
                  </h2>
                  {lec.content.key_concepts.length > 0 && (
                    <p className="text-sm text-gray-400 mt-0.5">
                      {lec.content.key_concepts.slice(0, 3).join(' · ')}
                      {lec.content.key_concepts.length > 3 && ' · ...'}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-4">
                {lec.revision_content && (
                  <span className="text-xs bg-amber-50 text-amber-600 border border-amber-200 px-2 py-0.5 rounded-full">
                    Revision
                  </span>
                )}
                <span className={`text-xs px-2 py-0.5 rounded-full border ${
                  lec.status === 'published'
                    ? 'bg-green-50 text-green-600 border-green-200'
                    : 'bg-gray-50 text-gray-400 border-gray-200'
                }`}>
                  {lec.status}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
