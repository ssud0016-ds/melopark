import { useState } from 'react'
import SearchBar from '../search/SearchBar'
import { LANDMARKS } from '../../data/mapData'

const QUICK_PICK_NAMES = ['Flinders Street Station', 'Melbourne Central', 'Queen Victoria Market']
const PARKING_TYPES = [
  {
    id: 'general',
    title: 'General parking',
    description: 'Standard timed and metered bays',
  },
  {
    id: 'accessible',
    title: 'Accessible parking',
    description: 'Standard timed and metered bays',
  },
]
const REQUIREMENT_CHIPS = [
  { id: 'all', label: 'All bays' },
  { id: 'available', label: 'Available' },
  { id: 'trap', label: 'Caution' },
  { id: 'lt1h', label: '<1 Hour' },
  { id: '1h', label: '1 Hour' },
  { id: '2h', label: '2 Hour' },
  { id: '3h', label: '3 Hour' },
  { id: '4h', label: '4 Hour' },
]

function toLocalDateTimeInputValue(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${d}T${hh}:${mm}`
}

export default function OnboardingOverlay({ onPick, onSkip }) {
  const [step, setStep] = useState('hero')
  const [localDestination, setLocalDestination] = useState(null)
  const [arriveByLocal, setArriveByLocal] = useState(() => toLocalDateTimeInputValue())
  const [parkingType, setParkingType] = useState('general')
  const [parkingRequirement, setParkingRequirement] = useState('all')
  const isHero = step === 'hero'

  const quickPicks = QUICK_PICK_NAMES
    .map((name) => LANDMARKS.find((l) => l.name === name))
    .filter(Boolean)

  const handlePick = (item) => {
    setLocalDestination(item)
  }

  const handleStart = () => {
    setStep('parking-type')
  }

  const handleParkingTypeContinue = () => {
    setStep('destination')
  }

  const handleContinue = () => {
    if (!localDestination) return
    const arrivalIso = arriveByLocal ? `${arriveByLocal}:00` : null
    onPick(localDestination, arrivalIso, {
      activeFilter: parkingRequirement,
      parkingType,
    })
  }

  return (
    <div
      className={
        isHero
          ? "absolute inset-0 z-[800] flex items-center justify-center bg-brand-dark px-6"
          : "absolute inset-0 z-[800] flex items-center justify-center bg-black/35 dark:bg-black/55 backdrop-blur-[2px] px-4"
      }
      role="dialog"
      aria-modal="true"
      aria-label={step === 'parking-type' ? 'Choose parking type' : 'Choose your destination'}
    >
      <div
        className={
          isHero
            ? "w-full max-w-md rounded-3xl bg-brand-900 shadow-card-lg p-7 sm:p-8"
            : "w-full max-w-md rounded-2xl bg-white dark:bg-surface-dark-secondary shadow-card-lg border border-gray-200/60 dark:border-gray-700/60 p-5 sm:p-6"
        }
      >
        {step === 'hero' ? (
          <>
            <div className="text-white text-lg font-semibold">Welcome to</div>
            <div className="mt-1 flex items-center gap-3">
              <div className="text-[44px] leading-none font-extrabold tracking-tight text-white">
                MelO<span className="text-accent">Park</span>
              </div>
              <div className="text-3xl" aria-hidden>
                🚗
              </div>
            </div>
            <div className="mt-4 text-sm leading-relaxed text-white/80">
              This app helps you find nearby parking bays, check availability, and view parking rules before you park.
            </div>
            <div className="mt-5 text-sm font-semibold text-accent">Stop Circling - Start Parking</div>

            <button
              type="button"
              onClick={handleStart}
              className="mt-10 w-full rounded-full bg-accent px-6 py-4 text-sm font-extrabold text-brand-dark shadow-card cursor-pointer hover:brightness-95 transition"
            >
              Let&apos;s get started now
            </button>
          </>
        ) : step === 'parking-type' ? (
          <>
            <div className="mb-8 text-[34px] font-bold tracking-tight text-brand">
              What are you looking for?
            </div>

            <div className="space-y-5">
              {PARKING_TYPES.map((option) => {
                const selected = parkingType === option.id
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setParkingType(option.id)}
                    className={`w-full rounded-3xl border bg-white px-6 py-6 text-center shadow-card transition cursor-pointer ${
                      selected
                        ? 'border-brand ring-2 ring-brand/15'
                        : 'border-gray-300/80 hover:border-brand-300'
                    }`}
                  >
                    <div className="text-2xl font-bold text-brand">{option.title}</div>
                    <div className="mt-1.5 text-sm font-semibold text-gray-500">
                      {option.description}
                    </div>
                  </button>
                )
              })}
            </div>

            <div className="mt-12 flex items-center justify-between gap-4">
              <button
                type="button"
                onClick={onSkip}
                className="min-w-[200px] rounded-full border border-gray-300 bg-white px-6 py-3 text-sm font-bold text-gray-500 shadow-sm transition hover:border-gray-400 cursor-pointer"
              >
                Skip, just show map
              </button>
              <button
                type="button"
                onClick={handleParkingTypeContinue}
                className="min-w-[146px] rounded-full border border-brand bg-brand px-6 py-3 text-sm font-bold text-white shadow-card transition hover:bg-brand-light cursor-pointer"
              >
                Continue
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="mb-3 text-[34px] font-bold tracking-tight text-brand">
              Where are you heading?
            </div>
            <div className="mb-6 text-sm font-semibold text-gray-500 dark:text-gray-400">
              Pick a destination and we&apos;ll show nearby parking bays.
            </div>

            <SearchBar
              destination={localDestination}
              onPick={handlePick}
              onClear={() => setLocalDestination(null)}
            />

            <div className="mt-5">
              <label className="flex flex-col gap-1">
                <span className="text-sm font-bold text-gray-500">
                  Arrive by
                </span>
                <input
                  type="datetime-local"
                  value={arriveByLocal}
                  onChange={(e) => setArriveByLocal(e.target.value)}
                  className="rounded-2xl border border-gray-300/90 bg-white px-5 py-4 text-base font-semibold text-gray-700 shadow-sm dark:border-gray-600 dark:bg-surface-dark dark:text-gray-100"
                />
              </label>
            </div>

            <div className="mt-6">
              <div className="mb-3 text-sm font-bold text-gray-500">
                Parking Requirements
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {REQUIREMENT_CHIPS.map((chip) => (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => setParkingRequirement(chip.id)}
                    className={`rounded-full border bg-white px-4 py-3 text-sm font-bold shadow-card transition cursor-pointer ${
                      parkingRequirement === chip.id
                        ? 'border-brand text-brand ring-2 ring-brand/15'
                        : 'border-gray-200/80 text-gray-500 hover:border-brand-300'
                    }`}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
              We use your destination to find nearby bays. Nothing is stored.
            </div>

            <div className="mt-8 flex items-center justify-between gap-4">
              <button
                type="button"
                onClick={onSkip}
                className="min-w-[200px] rounded-full border border-gray-300 bg-white px-6 py-3 text-sm font-bold text-gray-500 shadow-sm transition hover:border-gray-400 cursor-pointer"
              >
                Skip, just show map
              </button>

              <button
                type="button"
                onClick={handleContinue}
                disabled={!localDestination}
                className="min-w-[146px] rounded-full border border-brand bg-brand px-6 py-3 text-sm font-bold text-white shadow-card cursor-pointer hover:bg-brand-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
