'use client'

import { useEffect, useState } from 'react'

const PHASE_CONFIGS = {
  loading: {
    emoji: '🗺️',
    messages: [
      'Scanning university databases...',
      'Pulling course structures...',
      'Fetching curriculum data...',
      'Connecting to CurricuLLM...',
      'Almost there...',
    ],
    gradientFrom: '#6366f1',
    gradientTo: '#8b5cf6',
    dotColor: 'bg-indigo-400',
    label: 'Loading Curriculum',
    sublabel: 'Hang tight while we fetch the course data.',
  },
  blending: {
    emoji: '🧬',
    messages: [
      'Merging course outlines...',
      'Finding common themes...',
      'Weaving topics together...',
      'Personalizing your curriculum...',
      'Reconciling the differences...',
      'Adding the finishing touches...',
    ],
    gradientFrom: '#a855f7',
    gradientTo: '#ec4899',
    dotColor: 'bg-purple-400',
    label: 'Blending Curricula',
    sublabel: 'AI is merging both universities into your personalised mix.',
  },
  finalizing: {
    emoji: '🔒',
    messages: [
      'Locking in your curriculum...',
      'Saving all your hard work...',
      'Preparing lecture generation...',
      'Almost ready!',
    ],
    gradientFrom: '#10b981',
    gradientTo: '#0891b2',
    dotColor: 'bg-emerald-400',
    label: 'Finalizing Curriculum',
    sublabel: 'Saving your personalised curriculum.',
  },
  generating: {
    emoji: '✍️',
    messages: [
      'Writing lecture content...',
      'Crafting learning objectives...',
      'Adding examples and exercises...',
      'Building quiz questions...',
      'Polishing lecture materials...',
      'Adding real-world applications...',
      'This takes about 30–60 seconds...',
      'Still going strong...',
      'Great things take time!',
      'Generating slide notes...',
    ],
    gradientFrom: '#f59e0b',
    gradientTo: '#ef4444',
    dotColor: 'bg-amber-400',
    label: 'Generating Lectures',
    sublabel: 'Sit back — your lecture pack is being written.',
  },
}

interface LoadingScreenProps {
  phase: keyof typeof PHASE_CONFIGS
  extra?: string
}

export default function LoadingScreen({ phase, extra }: LoadingScreenProps) {
  const config = PHASE_CONFIGS[phase]
  const [msgIdx, setMsgIdx] = useState(0)
  const [msgVisible, setMsgVisible] = useState(true)

  useEffect(() => {
    const interval = setInterval(() => {
      setMsgVisible(false)
      setTimeout(() => {
        setMsgIdx((i) => (i + 1) % config.messages.length)
        setMsgVisible(true)
      }, 300)
    }, 2800)
    return () => clearInterval(interval)
  }, [config.messages.length])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-indigo-50">
      <div className="text-center max-w-xs px-6 animate-fade-in">

        {/* Floating icon with orbiting satellites */}
        <div className="relative w-24 h-24 mx-auto mb-8">
          {/* Glow ring */}
          <div
            className="absolute inset-0 rounded-full opacity-20 blur-xl"
            style={{ background: `linear-gradient(135deg, ${config.gradientFrom}, ${config.gradientTo})` }}
          />
          {/* Main circle */}
          <div
            className="relative w-24 h-24 rounded-full flex items-center justify-center text-4xl animate-float shadow-lg"
            style={{ background: `linear-gradient(135deg, ${config.gradientFrom}, ${config.gradientTo})` }}
          >
            {config.emoji}
          </div>

          {/* Orbiting dot 1 */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-24 h-24 relative animate-orbit" style={{ animationDuration: '3s' }}>
              <div className={`absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full ${config.dotColor} shadow-sm`} />
            </div>
          </div>

          {/* Orbiting dot 2 */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-20 h-20 relative animate-orbit-reverse" style={{ animationDuration: '2.2s' }}>
              <div className={`absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full opacity-70 bg-pink-400 shadow-sm`} />
            </div>
          </div>
        </div>

        {/* Title */}
        <h2 className="text-xl font-bold text-gray-800 mb-1">{config.label}</h2>
        <p className="text-xs text-gray-400 mb-5">{config.sublabel}</p>

        {/* Cycling message */}
        <div className="h-5 mb-6">
          <p
            className="text-sm text-gray-500 transition-all duration-300"
            style={{ opacity: msgVisible ? 1 : 0, transform: msgVisible ? 'translateY(0)' : 'translateY(4px)' }}
          >
            {config.messages[msgIdx]}
          </p>
        </div>

        {extra && (
          <p className="text-xs text-gray-400 mb-4 bg-gray-100 rounded-full px-3 py-1 inline-block">
            {extra}
          </p>
        )}

        {/* Bouncing dots */}
        <div className="flex justify-center gap-2">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full ${config.dotColor} animate-bounce`}
              style={{ animationDelay: `${i * 0.12}s`, animationDuration: '0.9s' }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
