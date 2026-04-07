'use client'

import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
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
      marker.current = new mapboxgl.Marker({ color: '#4f46e5' })
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
        setScrapedChapters(result.chapters)
        // Select all by default
        setSelected(new Set(result.chapters.map((_, i) => i)))
      }
    } catch {
      setError('Fetch failed. Try another university or upload a file.')
    } finally {
      setScraping(false)
    }
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
    if (!foundUni || selected.size === 0) return
    setMerging(true)
    const picked = scrapedChapters.filter((_, i) => selected.has(i))
    onInspire(picked, foundUni.name)
    // Reset
    setScrapedChapters([])
    setSelected(new Set())
    setFoundUni(null)
    setQuery('')
    setMerging(false)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Search bar */}
      <div className="p-3 border-b bg-white flex gap-2">
        <input
          className="flex-1 border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="Search any university (e.g. MIT, Oxford, UNSW)..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && geocodeAndPin()}
        />
        <button
          onClick={geocodeAndPin}
          disabled={searching}
          className="px-4 py-2 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700 disabled:opacity-50"
        >
          {searching ? '...' : 'Find'}
        </button>
      </div>

      {/* Map */}
      <div ref={mapContainer} className="flex-1 min-h-0" />

      {/* Results panel */}
      {(foundUni || scrapedChapters.length > 0 || error) && (
        <div className="border-t bg-white text-sm" style={{ maxHeight: '320px', overflowY: 'auto' }}>
          {error && <p className="text-red-500 px-4 py-3">{error}</p>}

          {/* Found uni — before scraping */}
          {foundUni && !scrapedChapters.length && !error && (
            <div className="flex items-center justify-between px-4 py-3">
              <p className="text-gray-600 truncate mr-2 text-xs">{foundUni.name}</p>
              <button
                onClick={scrapeAndShow}
                disabled={scraping}
                className="shrink-0 px-3 py-1.5 bg-indigo-600 text-white rounded text-xs hover:bg-indigo-700 disabled:opacity-50"
              >
                {scraping ? 'Fetching curriculum...' : 'Get Curriculum'}
              </button>
            </div>
          )}

          {/* Scraped chapters with checkboxes */}
          {scrapedChapters.length > 0 && (
            <div className="px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <p className="font-semibold text-gray-800 text-sm">
                  {scrapedChapters.length} chapters — pick what to merge
                </p>
                <div className="flex gap-2 text-xs">
                  <button onClick={selectAll} className="text-indigo-500 hover:underline">All</button>
                  <span className="text-gray-300">|</span>
                  <button onClick={selectNone} className="text-gray-400 hover:underline">None</button>
                </div>
              </div>

              <ul className="space-y-1 mb-3">
                {scrapedChapters.map((ch, idx) => (
                  <li
                    key={idx}
                    onClick={() => toggleChapter(idx)}
                    className={`flex gap-2.5 items-start p-2 rounded-lg cursor-pointer transition ${
                      selected.has(idx) ? 'bg-indigo-50 border border-indigo-200' : 'hover:bg-gray-50 border border-transparent'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(idx)}
                      onChange={() => toggleChapter(idx)}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-0.5 accent-indigo-600 shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-700 leading-tight">
                        {ch.number}. {ch.title}
                      </p>
                      {ch.topics.length > 0 && (
                        <p className="text-xs text-gray-400 mt-0.5 truncate">{ch.topics.slice(0, 3).join(' · ')}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>

              <button
                onClick={handleMerge}
                disabled={selected.size === 0 || merging}
                className="w-full py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
              >
                {merging ? 'Merging...' : `Merge ${selected.size} chapter${selected.size !== 1 ? 's' : ''} into my curriculum`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
