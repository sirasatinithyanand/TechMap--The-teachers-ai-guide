'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { LogOut, ChevronLeft } from 'lucide-react'

interface AppHeaderProps {
  backHref?: string
  backLabel?: string
  right?: React.ReactNode
}

export default function AppHeader({ backHref, backLabel, right }: AppHeaderProps) {
  const router = useRouter()
  const [initials, setInitials] = useState('')
  const [name, setName] = useState('')

  useEffect(() => {
    const stored = localStorage.getItem('tm_professor')
    if (stored) {
      const prof = JSON.parse(stored)
      setName(prof.name || '')
      setInitials(
        (prof.name || 'P')
          .split(' ')
          .map((w: string) => w[0])
          .join('')
          .toUpperCase()
          .slice(0, 2)
      )
    }
  }, [])

  function handleLogout() {
    localStorage.removeItem('tm_professor')
    router.push('/login')
  }

  return (
    <header className="sticky top-0 z-20 bg-surface-container-lowest border-b border-outline-variant/40">
      <div className="max-w-[1440px] mx-auto px-6 h-14 flex items-center justify-between gap-4">
        {/* Left */}
        <div className="flex items-center gap-3 min-w-0">
          {backHref ? (
            <motion.div whileHover={{ x: -2 }} transition={{ duration: 0.15 }}>
              <Link
                href={backHref}
                className="flex items-center gap-1.5 text-sm font-label text-on-surface-variant hover:text-on-surface transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                {backLabel || 'Back'}
              </Link>
            </motion.div>
          ) : (
            <Link href="/" className="font-headline font-[600] tracking-[-0.03em] text-on-surface text-base uppercase select-none">
              TeachMap
            </Link>
          )}
        </div>

        {/* Right slot */}
        <div className="flex items-center gap-3">
          {right}
          {initials && (
            <Link
              href="/profile"
              className="flex items-center gap-2 group"
              title={name}
            >
              <div className="w-7 h-7 rounded-full bg-on-surface flex items-center justify-center text-surface-container-lowest font-label text-xs font-semibold group-hover:bg-primary-container transition-colors">
                {initials}
              </div>
            </Link>
          )}
          <motion.button
            onClick={handleLogout}
            whileTap={{ scale: 0.95 }}
            className="text-on-surface-variant hover:text-on-surface transition-colors p-1 rounded"
            title="Log out"
          >
            <LogOut className="w-4 h-4" />
          </motion.button>
        </div>
      </div>
    </header>
  )
}
