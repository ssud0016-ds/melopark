import { useState } from 'react'
import SearchBar from '../search/SearchBar'
import { LANDMARKS } from '../../data/mapData'

const QUICK_PICK_NAMES = ['Flinders Street Station', 'Melbourne Central', 'Queen Victoria Market']

function toLocalDateTimeInputValue(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${d}T${hh}:${mm}`
}

const DURATION_CHIPS = [
  { id: '15min', label: '15 min' },
  { id: '30min', label: '30 min' },
  { id: '1h', label: '1H' },
  { id: '2h', label: '2H' },
  { id: '3h', label: '3H' },
  { id: '4h', label: '4H' },
  { id: 'custom', label: 'Custom' },
]

const chipBase = 'rounded-full border px-3 py-2 text-xs font-bold transition cursor-pointer'
const chipActive = 'border-brand bg-brand text-white'
const chipIdle = 'border-gray-200/80 bg-white text-gray-500 hover:border-brand-300 dark:border-gray-600 dark:bg-surface-dark dark:text-gray-300'

export default function OnboardingOverlay({ onPick, onSkip }) {
  const [step, setStep] = useState('hero')
  const [localDestination, setLocalDestination] = useState(null)
  const [arriveByLocal, setArriveByLocal] = useState(() => toLocalDateTimeInputValue())
  const [durationReq, setDurationReq] = useState(null)
  const [customDurationReq, setCustomDurationReq] = useState(60)
  const [customDurationUnit, setCustomDurationUnit] = useState('min')

  const quickPicks = QUICK_PICK_NAMES
    .map((name) => LANDMARKS.find((l) => l.name === name))
    .filter(Boolean)

  const handlePick = (item) => {
    setLocalDestination(item)
  }

  const handleStart = () => {
    setStep('destination')
  }

  const handleContinue = () => {
    if (!localDestination) return
    const arrivalIso = arriveByLocal ? `${arriveByLocal}:00` : null
    onPick(localDestination, arrivalIso)
  }

  return (
    <div
      className="absolute inset-0 z-[800] flex items-center justify-center bg-black/35 dark:bg-black/55 backdrop-blur-[2px] px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Choose your destination"
    >
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-surface-dark-secondary shadow-card-lg border border-gray-200/60 dark:border-gray-700/60 p-5 sm:p-6">
        {step === 'hero' ? (
          <>
            <div className="mb-1 text-2xl font-bold text-gray-900 dark:text-white">
              Welcome to MeloPark! 🚗
            </div>
            <div className="mb-5 text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
              This app helps you find nearby parking bays, check availability, and view parking rules before you park.
            </div>
            <div className="mb-4">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                Start by searching your destination
              </div>
              <SearchBar
                destination={localDestination}
                onPick={handlePick}
                onClear={() => setLocalDestination(null)}
              />
            </div>
            <div className="mb-5 space-y-2.5">
              <div className="flex items-center gap-2 rounded-lg border border-brand-200/80 bg-brand-50 px-3 py-2 text-xs font-medium text-gray-700 dark:border-gray-700/70 dark:bg-surface-dark/60 dark:text-gray-200">
                <span aria-hidden>📍</span>
                <span>Find parking near where you&apos;re heading</span>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-brand-200/80 bg-brand-50 px-3 py-2 text-xs font-medium text-gray-700 dark:border-gray-700/70 dark:bg-surface-dark/60 dark:text-gray-200">
                <span aria-hidden>🟢</span>
                <span>Check live availability in real time</span>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-brand-200/80 bg-brand-50 px-3 py-2 text-xs font-medium text-gray-700 dark:border-gray-700/70 dark:bg-surface-dark/60 dark:text-gray-200">
                <span aria-hidden>📋</span>
                <span>View parking rules before you park</span>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleStart}
                className="rounded-full border border-brand bg-brand px-4 py-2 text-sm font-semibold text-white shadow-card cursor-pointer hover:bg-brand-light transition-colors"
              >
                Let&apos;s get started →
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="mb-1 text-xl font-bold text-gray-900 dark:text-white">
              Where are you heading?
            </div>
            <div className="mb-4 text-sm text-gray-500 dark:text-gray-400">
              Pick a destination and we&apos;ll show nearby parking bays.
            </div>

            <SearchBar
              destination={localDestination}
              onPick={handlePick}
              onClear={() => setLocalDestination(null)}
            />

            <div className="mt-4">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                  Arrive by
                </span>
                <input
                  type="datetime-local"
                  value={arriveByLocal}
                  onChange={(e) => setArriveByLocal(e.target.value)}
                  className="rounded-lg border border-gray-200/90 bg-white px-2.5 py-2 text-xs font-medium text-gray-900 dark:border-gray-600 dark:bg-surface-dark dark:text-gray-100"
                />
              </label>
            </div>

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

              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Duration</div>
              <div className="flex flex-wrap gap-2 items-center">
                {DURATION_CHIPS.map((chip) => (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => setDurationReq(durationReq === chip.id ? null : chip.id)}
                    className={`${chipBase} ${durationReq === chip.id ? chipActive : chipIdle}`}
                  >
                    {chip.label}
                  </button>
                ))}
                {durationReq === 'custom' && (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min="1"
                      max={customDurationUnit === 'hr' ? 24 : 1440}
                      step={customDurationUnit === 'hr' ? 0.5 : 1}
                      value={customDurationUnit === 'hr' ? Math.round(customDurationReq / 60 * 10) / 10 : customDurationReq}
                      onChange={(e) => {
                        const val = Number(e.target.value)
                        setCustomDurationReq(customDurationUnit === 'hr' ? Math.round(val * 60) : val)
                      }}
                      placeholder={customDurationUnit === 'hr' ? 'hrs' : 'min'}
                      className="w-14 rounded-full border border-brand bg-white px-2 py-1.5 text-center text-xs font-semibold text-gray-700 outline-none dark:border-brand dark:bg-surface-dark dark:text-gray-100"
                    />
                    <div className="flex overflow-hidden rounded-full border border-gray-300 bg-white dark:border-gray-600 dark:bg-surface-dark">
                      {['min', 'hr'].map((u) => (
                        <button
                          key={u}
                          type="button"
                          onClick={() => setCustomDurationUnit(u)}
                          className={`px-2 py-1 text-[11px] font-semibold transition-colors cursor-pointer ${customDurationUnit === u ? 'bg-brand text-white' : 'text-gray-500 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'}${u === 'hr' ? ' border-l border-gray-300 dark:border-gray-600' : ''}`}
                        >
                          {u}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
              We use your destination to find nearby bays. Nothing is stored.
            </div>

            <div className="mt-4 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={onSkip}
                className="text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 cursor-pointer bg-transparent border-none"
              >
                Skip, just show the map
              </button>

              <button
                type="button"
                onClick={handleContinue}
                disabled={!localDestination}
                className="rounded-full border border-brand bg-brand px-4 py-2 text-xs font-semibold text-white shadow-card cursor-pointer hover:bg-brand-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
