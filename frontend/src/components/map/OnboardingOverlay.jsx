import { useState } from 'react'
import SearchBar from '../search/SearchBar'
import { LANDMARKS } from '../../data/mapData'

const QUICK_PICK_NAMES = ['Flinders Street Station', 'Melbourne Central', 'Queen Victoria Market']

export default function OnboardingOverlay({ onPick, onSkip }) {
  const [localDestination, setLocalDestination] = useState(null)

  const quickPicks = QUICK_PICK_NAMES
    .map((name) => LANDMARKS.find((l) => l.name === name))
    .filter(Boolean)

  const handlePick = (item) => {
    setLocalDestination(item)
    onPick(item)
  }

  return (
    <div
      className="absolute inset-0 z-[800] flex items-center justify-center bg-black/35 dark:bg-black/55 backdrop-blur-[2px] px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Choose your destination"
    >
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-surface-dark-secondary shadow-card-lg border border-gray-200/60 dark:border-gray-700/60 p-5 sm:p-6">
        <div className="mb-1 text-xl font-bold text-gray-900 dark:text-white">
          Where are you heading?
        </div>
        <div className="mb-4 text-sm text-gray-500 dark:text-gray-400">
          Pick a destination and we'll show nearby parking bays.
        </div>

        <SearchBar
          destination={localDestination}
          onPick={handlePick}
          onClear={() => setLocalDestination(null)}
        />

        <div className="mt-4">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
            Quick picks
          </div>
          <div className="flex flex-wrap gap-2">
            {quickPicks.map((lm) => (
              <button
                key={lm.name}
                type="button"
                onClick={() => handlePick(lm)}
                className="flex items-center gap-1.5 rounded-full border border-gray-200/60 dark:border-gray-700/60 bg-white dark:bg-surface-dark-secondary px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200 shadow-card cursor-pointer hover:bg-brand-50 dark:hover:bg-brand-900/30 transition-colors"
              >
                <span aria-hidden>{lm.icon}</span>
                {lm.name}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
          We use your destination to find nearby bays. Nothing is stored.
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onSkip}
            className="text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 cursor-pointer bg-transparent border-none"
          >
            Skip, just show the map
          </button>
        </div>
      </div>
    </div>
  )
}
