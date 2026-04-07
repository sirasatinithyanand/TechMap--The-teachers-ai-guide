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
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
        <header className="bg-white/80 backdrop-blur border-b px-6 py-4 flex items-center justify-between">
          <div className="space-y-1.5">
            <div className="skeleton h-5 w-40 rounded-lg" />
            <div className="skeleton h-3.5 w-28 rounded-lg" />
          </div>
        </header>
        <div className="max-w-3xl mx-auto px-6 py-8 space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border p-5 flex gap-4 items-start" style={{ animationDelay: `${i * 0.05}s` }}>
              <div className="skeleton h-8 w-8 rounded-lg shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-4 w-3/4 rounded-lg" />
                <div className="skeleton h-3 w-1/2 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div>
          <h1 className="text-lg font-bold text-gray-900">{course?.course_name}</h1>
          <p className="text-xs text-gray-400 mt-0.5">{course?.university_name} · {lectures.length} lectures</p>
        </div>
        <div className="flex gap-3">
          <a
            href={exportLectures(id)}
            className="px-4 py-2 border rounded-xl text-sm font-medium hover:bg-gray-50 flex items-center gap-1.5 transition"
            download
          >
            ↓ Export ZIP
          </a>
          <button
            onClick={() => router.push(`/course/${id}/dashboard`)}
            className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl text-sm font-semibold hover:from-indigo-700 hover:to-purple-700 transition shadow-sm"
          >
            Dashboard
          </button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-3">
        {lectures.map((lec, i) => (
          <div
            key={lec.id}
            onClick={() => router.push(`/course/${id}/lectures/${lec.lecture_number}`)}
            className="bg-white rounded-xl border p-5 cursor-pointer hover:border-indigo-300 hover:shadow-md transition-all group animate-fade-in"
            style={{ animationDelay: `${i * 0.04}s` }}
          >
            <div className="flex items-start justify-between">
              <div className="flex gap-4">
                <span className="text-2xl font-black text-indigo-100 group-hover:text-indigo-300 transition w-8 shrink-0 leading-none mt-0.5">
                  {lec.lecture_number}
                </span>
                <div>
                  <h2 className="font-semibold text-gray-900 group-hover:text-indigo-700 transition">
                    {lec.title}
                  </h2>
                  {lec.content.key_concepts.length > 0 && (
                    <p className="text-xs text-gray-400 mt-1">
                      {lec.content.key_concepts.slice(0, 3).join(' · ')}
                      {lec.content.key_concepts.length > 3 && ' · …'}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-4">
                {lec.revision_content && (
                  <span className="text-xs bg-amber-50 text-amber-600 border border-amber-200 px-2 py-0.5 rounded-full font-medium">
                    Revised
                  </span>
                )}
                <span className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${
                  lec.status === 'published'
                    ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
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
