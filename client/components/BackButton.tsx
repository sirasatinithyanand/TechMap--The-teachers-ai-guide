'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ChevronLeft } from 'lucide-react'

interface BackButtonProps {
  href: string
  label?: string
  className?: string
}

export default function BackButton({ href, label = 'Back', className = '' }: BackButtonProps) {
  return (
    <motion.div whileHover={{ x: -2 }} transition={{ duration: 0.15 }} className={className}>
      <Link
        href={href}
        className="inline-flex items-center gap-1 text-sm font-label text-on-surface-variant hover:text-on-surface transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        {label}
      </Link>
    </motion.div>
  )
}
