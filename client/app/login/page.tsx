'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { authLogin, authRegister } from '@/lib/api'

export default function LoginPage() {
  const router = useRouter()
  const [tab, setTab] = useState<'login' | 'register'>('login')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !password) return
    setLoading(true)
    setError('')
    try {
      const fn = tab === 'login' ? authLogin : authRegister
      const result = await fn(name.trim(), password)
      localStorage.setItem('tm_professor', JSON.stringify({ id: result.professor_id, name: result.name }))
      router.push('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 bg-surface">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-sm"
      >
        {/* Logo */}
        <div className="text-center mb-10">
          <p className="font-label text-xs tracking-[0.22em] text-on-surface-variant uppercase mb-3">
            Curriculum Builder
          </p>
          <h1 className="font-headline font-[540] text-4xl tracking-[-0.035em] text-on-surface leading-tight">
            TeachMap
          </h1>
          <p className="font-label text-sm text-on-surface-variant mt-2">
            AI-powered curriculum for professors
          </p>
        </div>

        {/* Card */}
        <div className="bg-surface-container-lowest rounded-lg shadow-card overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-surface-container">
            {(['login', 'register'] as const).map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); setError('') }}
                className={`flex-1 py-3 font-label text-xs font-semibold tracking-wide transition-colors relative ${
                  tab === t ? 'text-on-surface' : 'text-outline hover:text-on-surface-variant'
                }`}
              >
                {t === 'login' ? 'Log in' : 'Sign up'}
                {tab === t && (
                  <motion.div
                    layoutId="tab-underline"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-on-surface"
                  />
                )}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.form
              key={tab}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18 }}
              onSubmit={handleSubmit}
              className="p-6 space-y-4"
            >
              <div>
                <label className="font-label text-xs tracking-wide text-on-surface-variant uppercase block mb-1.5">
                  Your name
                </label>
                <input
                  className="w-full bg-surface-container-low rounded-lg px-4 py-2.5 text-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-1 focus:ring-outline transition"
                  placeholder="e.g. Dr. Smith"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                />
              </div>
              <div>
                <label className="font-label text-xs tracking-wide text-on-surface-variant uppercase block mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  className="w-full bg-surface-container-low rounded-lg px-4 py-2.5 text-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-1 focus:ring-outline transition"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <AnimatePresence>
                {error && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="font-label text-xs text-error"
                  >
                    {error}
                  </motion.p>
                )}
              </AnimatePresence>

              <motion.button
                type="submit"
                disabled={loading || !name.trim() || !password}
                whileTap={{ scale: 0.98 }}
                className="flex items-center justify-center gap-2 w-full py-3 bg-primary text-on-primary font-label text-sm font-semibold rounded-full hover:bg-primary-container disabled:opacity-40 transition-colors"
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
                    {tab === 'login' ? 'Logging in…' : 'Creating account…'}
                  </>
                ) : (
                  <>
                    {tab === 'login' ? 'Log in' : 'Create account'}
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </motion.button>
            </motion.form>
          </AnimatePresence>
        </div>

        <p className="font-label text-xs text-outline text-center mt-6">
          {tab === 'login' ? 'New here? ' : 'Already have an account? '}
          <button
            onClick={() => { setTab(tab === 'login' ? 'register' : 'login'); setError('') }}
            className="text-on-surface-variant hover:text-on-surface underline underline-offset-2 transition-colors"
          >
            {tab === 'login' ? 'Sign up →' : 'Log in →'}
          </button>
        </p>
      </motion.div>
    </main>
  )
}
