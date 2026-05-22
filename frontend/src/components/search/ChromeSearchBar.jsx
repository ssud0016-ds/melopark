import { useState, useRef, useEffect } from 'react'
import { MAP_SEARCH_COPY } from '../../content/searchCopy'
import { LANDMARKS } from '../../data/mapData'
import LogoMark from '../common/LogoMark'
import { useReducedMotion } from '../../hooks/useReducedMotion'

const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
const SEARCH_LIMIT = 8
const SEARCH_DEBOUNCE_MS = 300

function SettingsIcon({ className }) {
  return (
    <svg
      className={className}
      width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

function Highlight({ text, query }) {
  const i = text.toLowerCase().indexOf(query.toLowerCase())
  if (i < 0) return text
  return (
    <>
      {text.slice(0, i)}
      <strong className="text-gray-900 dark:text-white">{text.slice(i, i + query.length)}</strong>
      {text.slice(i + query.length)}
    </>
  )
}

const DEFAULT_SUGGESTIONS = LANDMARKS.slice(0, 8).map((l) => ({
  name: l.name,
  sub: l.sub,
  category: 'landmark',
  lat: l.lat,
  lng: l.lng,
  icon: l.icon,
}))

/**
 * Mobile-only chrome search bar. Fixed at top of viewport.
 * - destination set: LogoMark + truncated name + ⚙ + ✕
 * - empty: LogoMark + placeholder + ⚙
 * - isNavTrigger (Predictions page): bar is a tap target that calls onNavTrigger
 * - onboardingActive: shows a pulsing/static ring for onboarding Step 1
 */
export default function ChromeSearchBar({
  destination,
  onPick,
  onClear,
  onSettingsOpen,
  isNavTrigger = false,
  onNavTrigger,
  onboardingActive = false,
}) {
  const [query, setQuery] = useState('')
  const [matches, setMatches] = useState([])
  const [showDrop, setShowDrop] = useState(false)
  const [loading, setLoading] = useState(false)
  const [noResults, setNoResults] = useState(false)
  // 'pulse' | 'static' | 'none' — managed here based on onboardingActive + first interaction
  const [ringState, setRingState] = useState('none')
  const inputRef = useRef(null)
  const debounceRef = useRef(null)
  const noResTimerRef = useRef(null)
  const prefersReduced = useReducedMotion()

  // Sync ring state with onboarding lifecycle
  useEffect(() => {
    if (!onboardingActive) {
      setRingState('none')
      return
    }
    // If destination already picked (carried over), no ring needed
    if (destination) {
      setRingState('none')
      return
    }
    setRingState(prefersReduced ? 'static' : 'pulse')
  }, [onboardingActive, destination, prefersReduced])

  useEffect(() => {
    if (!destination) setQuery('')
  }, [destination])

  useEffect(() => {
    if (!query || query.trim().length < 2 || destination) {
      setMatches([])
      return
    }
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      const q = query.trim()
      setLoading(true)
      try {
        const res = await fetch(`${API_BASE}/api/search?q=${encodeURIComponent(q)}&limit=${SEARCH_LIMIT}`)
        if (!res.ok) throw new Error(`Search request failed with status ${res.status}`)
        const data = await res.json()
        setMatches(Array.isArray(data) ? data : [])
      } catch {
        const fallback = LANDMARKS.filter(
          (l) =>
            l.name.toLowerCase().includes(q.toLowerCase()) ||
            l.sub.toLowerCase().includes(q.toLowerCase()),
        )
          .slice(0, 6)
          .map((l) => ({ name: l.name, sub: l.sub, category: 'landmark', lat: l.lat, lng: l.lng, icon: l.icon }))
        setMatches(fallback)
      } finally {
        setLoading(false)
      }
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(debounceRef.current)
  }, [query, destination])

  const displayMatches = (!destination && query.trim().length < 2) ? DEFAULT_SUGGESTIONS : matches

  const pick = (item) => {
    setQuery(item.name)
    setShowDrop(false)
    setNoResults(false)
    if (onboardingActive) setRingState('none')
    onPick(item)
  }

  const handleChange = (e) => {
    const val = e.target.value
    setQuery(val)
    setShowDrop(true)
    setNoResults(false)
    if (destination && val !== destination.name) onClear()
  }

  const handleFocus = () => {
    // Stop pulsing on first tap — Polish 1
    if (ringState === 'pulse') setRingState('static')
    setShowDrop(true)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (displayMatches.length > 0) {
        pick(displayMatches[0])
        return
      }
      if (query.trim()) {
        setShowDrop(false)
        setNoResults(true)
        clearTimeout(noResTimerRef.current)
        noResTimerRef.current = setTimeout(() => setNoResults(false), 4500)
      }
    }
    if (e.key === 'Escape') {
      setShowDrop(false)
      setNoResults(false)
      onClear()
    }
  }

  const clear = () => {
    setQuery('')
    setShowDrop(false)
    setNoResults(false)
    setMatches([])
    onClear()
    inputRef.current?.focus()
  }

  // Ring wrapper class
  const ringClass =
    ringState === 'pulse'
      ? 'animate-pulse-ring ring-2 ring-brand ring-offset-1'
      : ringState === 'static'
      ? 'ring-2 ring-brand ring-offset-1'
      : ''

  // Predictions page: nav trigger mode — entire bar is a button to go to map
  if (isNavTrigger) {
    return (
      <div
        className="fixed left-0 right-0 z-search-bar px-3.5"
        style={{ top: 'max(8px, env(safe-area-inset-top))' }}
      >
        <button
          type="button"
          onClick={onNavTrigger}
          aria-label="Search for a destination — opens map"
          className="flex w-full h-12 items-center gap-2.5 rounded-xl border border-slate-200/60 bg-white/90 dark:bg-surface-dark-secondary/90 dark:border-slate-600/60 shadow-sm px-3 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1"
        >
          <span className="shrink-0 flex items-center justify-center w-8 h-8">
            <LogoMark size={24} />
          </span>
          <span className="flex-1 min-w-0 text-left text-sm text-gray-400 truncate">
            {MAP_SEARCH_COPY.placeholder}
          </span>
          <span className="shrink-0 flex items-center justify-center w-11 h-11" aria-hidden>
            <SettingsIcon className="text-gray-400" />
          </span>
        </button>
      </div>
    )
  }

  return (
    <div
      className={`fixed left-0 right-0 z-search-bar px-3.5 ${ringClass} rounded-xl`}
      style={{ top: 'max(8px, env(safe-area-inset-top))' }}
    >
      {/* Main bar */}
      <div className="flex h-12 items-center gap-0 rounded-xl border border-slate-200 bg-white dark:bg-surface-dark-secondary dark:border-slate-600 shadow-sm overflow-hidden">
        {/* Logo tap target — tapping the logo clears destination and resets to map default */}
        <button
          type="button"
          onClick={destination ? clear : undefined}
          aria-label="MelOPark"
          className="flex w-11 h-11 items-center justify-center shrink-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset"
          tabIndex={destination ? 0 : -1}
        >
          <LogoMark size={24} />
        </button>

        {/* Input area — destination or placeholder */}
        {destination ? (
          <button
            type="button"
            onClick={() => { onClear(); setTimeout(() => inputRef.current?.focus(), 50) }}
            className="flex-1 min-w-0 text-left text-sm font-medium text-gray-900 dark:text-gray-100 truncate pr-1 cursor-text focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset"
            aria-label={`Destination: ${destination.name}. Tap to change.`}
          >
            <span className="block truncate">{destination.name}</span>
          </button>
        ) : (
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            onBlur={() => setTimeout(() => setShowDrop(false), 150)}
            placeholder={MAP_SEARCH_COPY.placeholder}
            aria-label={MAP_SEARCH_COPY.accessibilityLabelEmpty}
            aria-autocomplete="list"
            className="flex-1 min-w-0 border-none bg-transparent outline-none focus-visible:outline-none text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400"
          />
        )}

        {loading && <span className="text-xs text-gray-400 shrink-0 pr-1">…</span>}

        {/* Right icons — ⚙ always visible, ✕ when destination set */}
        <button
          type="button"
          onClick={onSettingsOpen}
          aria-label="Open settings"
          className="flex w-11 h-11 shrink-0 items-center justify-center cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset"
        >
          <SettingsIcon className="text-gray-500 dark:text-gray-400" />
        </button>

        {destination && (
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); clear() }}
            aria-label="Clear destination"
            className="flex w-11 h-11 shrink-0 items-center justify-center cursor-pointer text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-xl leading-none focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset"
          >
            &times;
          </button>
        )}
      </div>

      {/* Autocomplete dropdown */}
      {showDrop && !destination && displayMatches.length > 0 && (
        <div
          className="absolute left-3.5 right-3.5 top-[calc(100%+4px)] bg-white dark:bg-surface-dark-secondary rounded-xl overflow-hidden z-50 shadow-card-lg border border-gray-200/60 dark:border-gray-700/60"
          role="listbox"
        >
          {query.trim().length < 2 && (
            <div className="px-4 pt-2.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">
              {MAP_SEARCH_COPY.dropdownSection}
            </div>
          )}
          {displayMatches.map((item, i) => (
            <div
              key={i}
              role="option"
              aria-selected={false}
              onMouseDown={(e) => { e.preventDefault(); pick(item) }}
              className="flex items-center gap-3 px-4 py-2.5 cursor-pointer text-sm border-b border-gray-100 dark:border-gray-700 last:border-b-0 hover:bg-brand-50 dark:hover:bg-brand-900/30 transition-colors"
            >
              <span className="text-base shrink-0">{item.icon || '📍'}</span>
              <div>
                <div className="font-semibold text-gray-900 dark:text-white">
                  <Highlight text={item.name} query={query} />
                </div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {item.sub}{item.category ? ` · ${item.category}` : ''}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* No results */}
      {showDrop && query.trim().length >= 2 && !destination && matches.length === 0 && !loading && (
        <div className="absolute left-3.5 right-3.5 top-[calc(100%+4px)] bg-white dark:bg-surface-dark-secondary rounded-xl z-50 shadow-card-lg border border-gray-200/60 dark:border-gray-700/60 px-4 py-3.5">
          <div className="text-sm text-gray-500">
            <div className="font-semibold text-gray-700 dark:text-gray-200">{MAP_SEARCH_COPY.noResultsTitle}</div>
            <div className="text-xs mt-0.5">{MAP_SEARCH_COPY.noResultsDetail}</div>
          </div>
        </div>
      )}

      {/* No-results toast */}
      {noResults && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[200] bg-white dark:bg-surface-dark-secondary rounded-2xl p-7 text-center shadow-card-lg max-w-[280px] w-[90%]">
          <div className="text-base font-bold text-gray-900 dark:text-white mb-2">No results found</div>
          <div className="text-sm text-gray-500 leading-relaxed mb-4">
            {MAP_SEARCH_COPY.noResultsToastDetail}
          </div>
          <button
            onClick={() => { setNoResults(false); clear() }}
            className="bg-brand text-white rounded-lg px-5 py-2 text-sm font-semibold cursor-pointer hover:bg-brand-light transition-colors"
          >
            Clear &amp; Try Again
          </button>
        </div>
      )}
    </div>
  )
}
