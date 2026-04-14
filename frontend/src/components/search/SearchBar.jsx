import { useState, useRef, useEffect } from 'react'
import { LANDMARKS } from '../../data/mapData'

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

export default function SearchBar({ destination, onPick, onClear }) {
  const [query, setQuery] = useState('')
  const [showDrop, setShowDrop] = useState(false)
  const [noResults, setNoResults] = useState(false)
  const inputRef = useRef(null)
  const noResTimerRef = useRef(null)

  useEffect(() => {
    if (!destination) setQuery('')
  }, [destination])

  const matches = query && !destination
    ? LANDMARKS.filter(
        (l) =>
          l.name.toLowerCase().includes(query.toLowerCase()) ||
          l.sub.toLowerCase().includes(query.toLowerCase()),
      ).slice(0, 6)
    : []

  const pick = (lm) => {
    setQuery(lm.name)
    setShowDrop(false)
    setNoResults(false)
    onPick(lm)
  }

  const handleChange = (e) => {
    const val = e.target.value
    setQuery(val)
    setShowDrop(true)
    setNoResults(false)
    if (destination && val !== destination.name) onClear()
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      const q = query.trim().toLowerCase()
      const m = LANDMARKS.find(
        (l) => l.name.toLowerCase().includes(q) || l.sub.toLowerCase().includes(q),
      )
      if (m) { pick(m); return }
      if (q) {
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
    onClear()
    inputRef.current?.focus()
  }

  return (
    <div className="relative flex-1">
      {/* Input pill */}
      <div className="flex items-center gap-2.5 bg-white dark:bg-surface-dark-secondary rounded-xl px-4 py-2.5 shadow-overlay border border-gray-200/60 dark:border-gray-700/60">
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" className="shrink-0 text-gray-400">
          <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.5" />
          <line x1="10" y1="10" x2="14" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <input
          ref={inputRef}
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowDrop(true)}
          onBlur={() => setTimeout(() => setShowDrop(false), 150)}
          placeholder="Search Melbourne CBD address or landmark..."
          aria-label="Search for a destination in Melbourne CBD"
          aria-autocomplete="list"
          className="flex-1 border-none bg-transparent outline-none font-sans text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400"
        />
        {query && (
          <button
            onMouseDown={(e) => { e.preventDefault(); clear() }}
            aria-label="Clear search"
            className="bg-transparent border-none cursor-pointer text-gray-400 text-lg leading-none px-0.5 hover:text-gray-600"
          >
            &times;
          </button>
        )}
      </div>

      {/* Autocomplete dropdown */}
      {showDrop && matches.length > 0 && (
        <div
          className="absolute top-[calc(100%+6px)] inset-x-0 bg-white dark:bg-surface-dark-secondary rounded-xl overflow-hidden z-50 shadow-card-lg border border-gray-200/60 dark:border-gray-700/60"
          role="listbox"
        >
          {matches.map((lm, i) => (
            <div
              key={i}
              role="option"
              aria-selected={false}
              onMouseDown={(e) => { e.preventDefault(); pick(lm) }}
              className="flex items-center gap-3 px-4 py-2.5 cursor-pointer text-sm border-b border-gray-100 dark:border-gray-700 last:border-b-0 hover:bg-brand-50 dark:hover:bg-brand-900/30 transition-colors"
            >
              <span className="text-lg shrink-0">{lm.icon}</span>
              <div>
                <div className="font-semibold text-gray-900 dark:text-white">
                  <Highlight text={lm.name} query={query} />
                </div>
                <div className="text-xs text-gray-400 mt-0.5">{lm.sub}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* No results in dropdown */}
      {showDrop && query && !destination && matches.length === 0 && (
        <div className="absolute top-[calc(100%+6px)] inset-x-0 bg-white dark:bg-surface-dark-secondary rounded-xl z-50 shadow-card-lg border border-gray-200/60 dark:border-gray-700/60 px-4 py-3.5">
          <div className="flex items-center gap-2.5 text-gray-400 text-sm">
            <span>🔍</span>
            <div>
              <div className="font-semibold">No matching places</div>
              <div className="text-xs mt-0.5">MeloPark covers Melbourne CBD only. Try "Flinders", "RMIT", or a CBD street name.</div>
            </div>
          </div>
        </div>
      )}

      {/* Full no-results toast */}
      {noResults && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[200] bg-white dark:bg-surface-dark-secondary rounded-2xl p-7 text-center shadow-card-lg max-w-[280px] w-[90%]">
          <div className="text-[40px] mb-3">🔍</div>
          <div className="text-base font-bold text-gray-900 dark:text-white mb-2">No results found</div>
          <div className="text-sm text-gray-500 leading-relaxed mb-4">
            We couldn't find "{query}". MeloPark covers <span className="font-semibold text-gray-700 dark:text-gray-300">Melbourne CBD only</span> — try a landmark like "Flinders Street" or "Melbourne Central".
          </div>
          <button
            onClick={() => { setNoResults(false); clear() }}
            className="bg-brand text-white border-none rounded-lg px-5 py-2 text-sm font-semibold cursor-pointer font-sans hover:bg-brand-light transition-colors"
          >
            Clear & Try Again
          </button>
        </div>
      )}
    </div>
  )
}
