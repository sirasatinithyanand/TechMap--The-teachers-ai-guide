'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Pencil, Check, X, BookOpen, ExternalLink } from 'lucide-react'
import AppHeader from '@/components/AppHeader'
import { getProfessorCourses } from '@/lib/api'

interface ProfProfile {
  department: string
  bio: string
  researchLink: string
}

const emptyProfile: ProfProfile = { department: '', bio: '', researchLink: '' }

export default function ProfilePage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [profId, setProfId] = useState('')
  const [profile, setProfile] = useState<ProfProfile>(emptyProfile)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<ProfProfile>(emptyProfile)
  const [courseCount, setCourseCount] = useState<number | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem('tm_professor')
    if (!stored) { router.push('/login'); return }
    const prof = JSON.parse(stored)
    setName(prof.name || 'Professor')
    setProfId(prof.id)

    const savedProfile = localStorage.getItem('tm_profile')
    if (savedProfile) setProfile(JSON.parse(savedProfile))

    getProfessorCourses(prof.id)
      .then((courses) => setCourseCount(courses.length))
      .catch(() => setCourseCount(0))
  }, [router])

  function startEdit() {
    setDraft({ ...profile })
    setEditing(true)
  }

  function cancelEdit() {
    setEditing(false)
  }

  function saveEdit() {
    setProfile(draft)
    localStorage.setItem('tm_profile', JSON.stringify(draft))
    setEditing(false)
  }

  const initials = name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)

  return (
    <div className="min-h-screen bg-surface">
      <AppHeader backHref="/" backLabel="Home" />

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="max-w-2xl mx-auto px-6 py-12"
      >
        {/* Avatar + name */}
        <div className="flex items-start gap-6 mb-10">
          <div className="w-20 h-20 rounded-full bg-on-surface flex items-center justify-center text-surface-container-lowest font-label text-2xl font-semibold shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0 pt-1">
            <h1 className="font-headline font-[540] text-3xl tracking-[-0.03em] text-on-surface leading-tight">
              {name}
            </h1>
            {profile.department && (
              <p className="font-label text-sm text-on-surface-variant mt-1">{profile.department}</p>
            )}
            <div className="flex items-center gap-4 mt-3">
              {courseCount !== null && (
                <div className="flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-on-surface-variant" />
                  <span className="font-label text-xs text-on-surface-variant">
                    {courseCount} course{courseCount !== 1 ? 's' : ''}
                  </span>
                </div>
              )}
              {profile.researchLink && (
                <a
                  href={profile.researchLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 font-label text-xs text-on-surface-variant hover:text-on-surface transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                  Research link
                </a>
              )}
            </div>
          </div>
          {!editing && (
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={startEdit}
              className="flex items-center gap-1.5 font-label text-xs text-on-surface-variant hover:text-on-surface transition-colors border border-outline-variant rounded-full px-3 py-1.5 shrink-0"
            >
              <Pencil className="w-3 h-3" />
              Edit
            </motion.button>
          )}
        </div>

        {/* Profile details */}
        <AnimatePresence mode="wait">
          {editing ? (
            <motion.div
              key="edit"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              className="bg-surface-container-lowest rounded-lg p-6 shadow-card space-y-5"
            >
              <p className="font-label text-xs tracking-widest text-on-surface-variant uppercase">Edit Profile</p>

              <div>
                <label className="font-label text-xs text-on-surface-variant uppercase tracking-wide block mb-1.5">Department</label>
                <input
                  className="w-full bg-surface-container-low rounded-lg px-4 py-2.5 text-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-1 focus:ring-outline transition"
                  placeholder="e.g. School of Computer Science"
                  value={draft.department}
                  onChange={(e) => setDraft((d) => ({ ...d, department: e.target.value }))}
                />
              </div>

              <div>
                <label className="font-label text-xs text-on-surface-variant uppercase tracking-wide block mb-1.5">
                  Bio <span className="normal-case text-outline">(shown to students)</span>
                </label>
                <textarea
                  className="w-full bg-surface-container-low rounded-lg px-4 py-2.5 text-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-1 focus:ring-outline transition resize-none min-h-[90px]"
                  placeholder="A short introduction for your students..."
                  value={draft.bio}
                  maxLength={500}
                  onChange={(e) => setDraft((d) => ({ ...d, bio: e.target.value }))}
                />
                <p className="font-label text-xs text-outline mt-1 text-right">{draft.bio.length}/500</p>
              </div>

              <div>
                <label className="font-label text-xs text-on-surface-variant uppercase tracking-wide block mb-1.5">Research / Profile Link</label>
                <input
                  className="w-full bg-surface-container-low rounded-lg px-4 py-2.5 text-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-1 focus:ring-outline transition"
                  placeholder="https://scholar.google.com/..."
                  value={draft.researchLink}
                  onChange={(e) => setDraft((d) => ({ ...d, researchLink: e.target.value }))}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={saveEdit}
                  className="flex items-center gap-1.5 bg-primary text-on-primary font-label text-sm font-semibold px-5 py-2.5 rounded-full hover:bg-primary-container transition-colors"
                >
                  <Check className="w-3.5 h-3.5" />
                  Save
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={cancelEdit}
                  className="flex items-center gap-1.5 font-label text-sm text-on-surface-variant px-5 py-2.5 rounded-full hover:bg-surface-container transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                  Cancel
                </motion.button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              {profile.bio ? (
                <div className="bg-surface-container-lowest rounded-lg p-6 shadow-card">
                  <p className="font-label text-xs tracking-widest text-on-surface-variant uppercase mb-3">Bio</p>
                  <p className="text-sm text-on-surface leading-relaxed">{profile.bio}</p>
                </div>
              ) : (
                <div className="bg-surface-container-low rounded-lg p-6 text-center">
                  <p className="text-sm text-on-surface-variant mb-3">No bio added yet.</p>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={startEdit}
                    className="font-label text-sm font-semibold text-on-surface underline underline-offset-2"
                  >
                    Add your bio →
                  </motion.button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Go to courses */}
        <motion.button
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => router.push('/')}
          className="mt-8 w-full bg-primary text-on-primary font-label text-sm font-semibold py-3 rounded-full hover:bg-primary-container transition-colors"
        >
          View My Courses →
        </motion.button>
      </motion.div>
    </div>
  )
}
