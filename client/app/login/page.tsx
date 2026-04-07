'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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
    <main className="min-h-screen flex flex-col items-center justify-center px-4 bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">TeachMap</h1>
          <p className="text-gray-500 mt-1 text-sm">AI-powered curriculum for professors</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b">
            {(['login', 'register'] as const).map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); setError('') }}
                className={`flex-1 py-3 text-sm font-semibold transition ${
                  tab === t ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                {t === 'login' ? 'Log in' : 'Sign up'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Your name</label>
              <input
                className="w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                placeholder="e.g. Dr. Smith"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Password</label>
              <input
                type="password"
                className="w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error && <p className="text-red-500 text-xs">{error}</p>}

            <button
              type="submit"
              disabled={loading || !name.trim() || !password}
              className="w-full py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition"
            >
              {loading ? '...' : tab === 'login' ? 'Log in' : 'Create account'}
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}
