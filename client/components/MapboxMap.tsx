'use client'

import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Check } from 'lucide-react'
import type { Chapter } from '@/lib/api'
import { searchUniversity, saveInspiration } from '@/lib/api'

interface Props {
  courseId: string
  courseName: string
  onInspire: (selectedChapters: Chapter[], universityName: string) => void
}

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!

export default function MapboxMap({ courseId, courseName, onInspire }: Props) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const marker = useRef<mapboxgl.Marker | null>(null)

  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [scraping, setScraping] = useState(false)
  const [foundUni, setFoundUni] = useState<{ name: string; lng: number; lat: number } | null>(null)
  const [scrapedChapters, setScrapedChapters] = useState<Chapter[]>([])
  const [modalUniName, setModalUniName] = useState('')
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [merging, setMerging] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (map.current || !mapContainer.current) return
    mapboxgl.accessToken = TOKEN
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [0, 20],
      zoom: 1.5,
    })
    map.current.addControl(new mapboxgl.NavigationControl(), 'bottom-right')
    return () => { map.current?.remove(); map.current = null }
  }, [])

  async function geocodeAndPin() {
    if (!query.trim() || !map.current) return
    setSearching(true)
    setError('')
    setScrapedChapters([])
    setSelected(new Set())
    setFoundUni(null)
    try {
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${TOKEN}&types=poi,place&limit=1`
      )
      const data = await res.json()
      const feature = data.features?.[0]
      if (!feature) { setError('University not found on map.'); return }

      const [lng, lat] = feature.center
      const name = feature.place_name

      map.current.flyTo({ center: [lng, lat], zoom: 12, duration: 1500 })
      marker.current?.remove()
      marker.current = new mapboxgl.Marker({ color: '#1a1c1c' })
        .setLngLat([lng, lat])
        .setPopup(new mapboxgl.Popup().setText(name))
        .addTo(map.current)

      setFoundUni({ name, lng, lat })
    } catch {
      setError('Map search failed.')
    } finally {
      setSearching(false)
    }
  }

  async function scrapeAndShow() {
    if (!foundUni) return
    setScraping(true)
    setError('')
    setSelected(new Set())
    try {
      const result = await searchUniversity(query, courseName)
      if (!result.chapters.length) {
        setError('No curriculum found. Try uploading a file instead.')
      } else {
        setModalUniName(foundUni.name)
        setScrapedChapters(result.chapters)
        setSelected(new Set(result.chapters.map((_, i) => i)))
      }
    } catch {
      setError('Fetch failed. Try another university or upload a file.')
    } finally {
      setScraping(false)
    }
  }

  function closeModal() {
    setScrapedChapters([])
    setSelected(new Set())
  }

  function toggleChapter(idx: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(idx) ? next.delete(idx) : next.add(idx)
      return next
    })
  }

  function selectAll() { setSelected(new Set(scrapedChapters.map((_, i) => i))) }
  function selectNone() { setSelected(new Set()) }

  async function handleMerge() {
    if (!selected.size) return
    setMerging(true)
    const picked = scrapedChapters.filter((_, i) => selected.has(i))
    const uniName = modalUniName
    // Reset before callback so modal closes cleanly
    setScrapedChapters([])
    setSelected(new Set())
    setFoundUni(null)
    setQuery('')
    onInspire(picked, uniName)
    try { await saveInspiration(courseId, uniName, courseName, picked) } catch {}
    setMerging(false)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Search bar */}
      <div className="px-3 py-2.5 border-b border-outline-variant/40 bg-surface-container-lowest flex flex-col gap-1.5">
        <div className="flex gap-2">
          <input
            className="flex-1 bg-surface-container-low rounded-lg px-3 py-2 text-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-1 focus:ring-outline transition min-w-0"
            placeholder="Search any university (e.g. MIT, Oxford, UNSW)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && geocodeAndPin()}
          />
          <button
            onClick={geocodeAndPin}
            disabled={searching || !query.trim()}
            className="shrink-0 px-4 py-2 bg-primary text-on-primary font-label text-xs font-semibold rounded-full hover:bg-primary-container disabled:opacity-40 transition-colors"
          >
            {searching ? (
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
                Finding…
              </span>
            ) : 'Find University'}
          </button>
          <button
            onClick={scrapeAndShow}
            disabled={!foundUni || scraping}
            className={`shrink-0 px-4 py-2 font-label text-xs font-semibold rounded-full border border-outline-variant transition-colors ${
              foundUni && !scraping
                ? 'text-on-surface hover:bg-surface-container-low'
                : 'text-outline opacity-40 cursor-not-allowed'
            }`}
          >
            {scraping ? (
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 border-2 border-outline border-t-transparent rounded-full animate-spin" />
                Fetching…
              </span>
            ) : 'Get Curriculum'}
          </button>
        </div>
        {error && (
          <p className="font-label text-xs text-error px-1">{error}</p>
        )}
        {foundUni && !error && (
          <p className="font-label text-xs text-on-surface-variant px-1 truncate">
            📍 {foundUni.name}
          </p>
        )}
      </div>

      {/* Map */}
      <div ref={mapContainer} className="flex-1 min-h-0" />

      {/* Chapters modal */}
      <AnimatePresence>
        {scrapedChapters.length > 0 && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-on-surface/20 backdrop-blur-sm"
              onClick={closeModal}
            />

            {/* Modal card */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              className="relative bg-surface-container-lowest rounded-lg shadow-float w-full max-w-md flex flex-col"
              style={{ maxHeight: '70vh' }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-surface-container shrink-0">
                <div className="min-w-0 mr-3">
                  <p className="font-label text-[10px] tracking-widest text-on-surface-variant uppercase">
                    {scrapedChapters.length} chapters found
                  </p>
                  <p className="font-headline font-[500] text-sm text-on-surface truncate mt-0.5">
                    {modalUniName}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <button onClick={selectAll} className="font-label text-xs text-on-surface-variant hover:text-on-surface transition-colors">All</button>
                  <span className="text-outline-variant">·</span>
                  <button onClick={selectNone} className="font-label text-xs text-on-surface-variant hover:text-on-surface transition-colors">None</button>
                  <button onClick={closeModal} className="text-outline hover:text-on-surface transition-colors ml-1">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Scrollable chapters */}
              <div className="overflow-y-auto flex-1 px-4 py-3 space-y-1">
                {scrapedChapters.map((ch, idx) => (
                  <button
                    key={idx}
                    onClick={() => toggleChapter(idx)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg flex items-start gap-3 transition-colors ${
                      selected.has(idx)
                        ? 'bg-on-surface text-on-primary'
                        : 'hover:bg-surface-container-low text-on-surface'
                    }`}
                  >
                    <span className={`font-label text-xs font-bold w-4 shrink-0 mt-0.5 ${
                      selected.has(idx) ? 'text-surface-container-highest' : 'text-on-surface-variant'
                    }`}>
                      {ch.number}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-headline font-[500] text-xs leading-tight">{ch.title}</p>
                      {ch.topics.length > 0 && (
                        <p className={`font-label text-[10px] mt-0.5 truncate ${
                          selected.has(idx) ? 'text-surface-container-highest' : 'text-outline'
                        }`}>
                          {ch.topics.slice(0, 3).join(' · ')}
                        </p>
                      )}
                    </div>
                    {selected.has(idx) && (
                      <Check className="w-3 h-3 shrink-0 mt-0.5 text-surface-container-highest" />
                    )}
                  </button>
                ))}
              </div>

              {/* Footer */}
              <div className="px-5 py-4 border-t border-surface-container shrink-0">
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={handleMerge}
                  disabled={selected.size === 0 || merging}
                  className="w-full py-3 bg-primary text-on-primary font-label text-sm font-semibold rounded-full hover:bg-primary-container disabled:opacity-40 transition-colors"
                >
                  {merging
                    ? 'Merging…'
                    : `Merge ${selected.size} chapter${selected.size !== 1 ? 's' : ''} into my curriculum`}
                </motion.button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
