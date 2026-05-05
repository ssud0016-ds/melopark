import { useState } from 'react'
import SearchBar from '../search/SearchBar'
import { melbourneAwareIsoFromDateTimeLocal, toMelbourneDateTimeInputValue } from '../../utils/plannerTime'

const STATUS_CHIPS = [
  { id: 'all', label: 'All' },
  { id: 'available', label: 'Available' },
  { id: 'accessible', label: 'Accessible' },
  { id: 'trap', label: 'Caution' },
]

const DURATION_CHIPS = [
  { id: '15min', label: '15 min' },
  { id: '30min', label: '30 min' },
  { id: '1h', label: '1H' },
  { id: '2h', label: '2H' },
  { id: '3h', label: '3H' },
  { id: '4h', label: '4H' },
  { id: 'custom', label: 'Custom' },
]

const chipBase =
  'rounded-full border px-3 py-1 text-[11px] font-semibold tracking-wide transition cursor-pointer'
const chipActive =
  'border-brand bg-brand text-white'
const chipIdle =
  'border-gray-200/80 bg-white text-gray-500 hover:border-brand-300 dark:border-gray-600 dark:bg-surface-dark dark:text-gray-300'

export default function OnboardingOverlay({ onPick, onSkip, busyNowManifest }) {
  const [step, setStep] = useState('hero')
  const [localDestination, setLocalDestination] = useState(null)
  const [arriveByLocal, setArriveByLocal] = useState(() => toMelbourneDateTimeInputValue(null))
  const [statusReq, setStatusReq] = useState('all')
  const [durationReq, setDurationReq] = useState(null)
  const [customDurationReq, setCustomDurationReq] = useState(60)
  const [customDurationUnit, setCustomDurationUnit] = useState('min')
  const isHero = step === 'hero'

  const hasPressureData = busyNowManifest != null && (busyNowManifest.total_segments ?? 0) > 0

  const handlePick = (item) => {
    setLocalDestination(item)
  }

  const handleStart = () => {
    setStep('destination')
  }

  const handleContinue = () => {
    if (!localDestination) return
    if (hasPressureData && step === 'destination') {
      setStep('pressure')
      return
    }
    const arrivalIso = arriveByLocal ? melbourneAwareIsoFromDateTimeLocal(arriveByLocal) : null
    onPick(localDestination, arrivalIso, {
      statusFilter: statusReq,
      durationFilter: durationReq,
      customDuration: customDurationReq,
      accessible: statusReq === 'accessible',
    })
  }

  const handlePressureDone = () => {
    const arrivalIso = arriveByLocal ? melbourneAwareIsoFromDateTimeLocal(arriveByLocal) : null
    onPick(localDestination, arrivalIso, {
      statusFilter: statusReq,
      durationFilter: durationReq,
      customDuration: customDurationReq,
      accessible: statusReq === 'accessible',
    })
  }

  return (
    <div
      className={
        isHero
          ? "absolute inset-0 z-[800] flex items-center justify-center bg-black/30 backdrop-blur-[2px] px-6"
          : "absolute inset-0 z-[800] flex items-center justify-center bg-black/35 dark:bg-black/55 backdrop-blur-[2px] px-4 overflow-y-auto"
      }
      role="dialog"
      aria-modal="true"
      aria-label="Choose your destination"
    >
      <div
        className={
          isHero
            ? "w-full max-w-md rounded-3xl bg-brand-900 shadow-card-lg p-7 sm:p-8"
            : "w-full max-w-md rounded-2xl bg-white dark:bg-surface-dark-secondary shadow-card-lg border border-gray-200/60 dark:border-gray-700/60 p-5 sm:p-6 my-6"
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
        ) : step === 'destination' ? (
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
              <div className="mb-2 text-sm font-bold text-gray-500">
                Parking Requirements
              </div>

              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Status</div>
              <div className="flex flex-wrap gap-2 mb-4">
                {STATUS_CHIPS.map((chip) => (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => setStatusReq(chip.id)}
                    className={`${chipBase} ${statusReq === chip.id ? chipActive : chipIdle}`}
                  >
                    {chip.label}
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
                {hasPressureData ? 'Next' : 'Continue'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="mb-2 text-[26px] font-bold tracking-tight text-brand">
              What you'll see on the map
            </div>
            <div className="mb-5 text-sm font-medium text-gray-500 dark:text-gray-400">
              Street colour = parking chance right now
            </div>

            <div className="flex flex-col gap-3">
              {[
                { color: '#22c55e', label: 'Good chance of finding a spot' },
                { color: '#f97316', label: 'Getting busy' },
                { color: '#ef4444', label: 'Hard to park right now' },
                { color: '#cbd5e1', label: 'No live data for this street' },
              ].map(({ color, label }) => (
                <div key={label} className="flex items-center gap-3">
                  <span
                    className="h-1.5 w-8 shrink-0 rounded-full"
                    style={{ backgroundColor: color }}
                    aria-hidden
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{label}</span>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-700/50 dark:bg-emerald-950/50 dark:text-emerald-100">
              The panel below the map shows quieter zones near your destination. Tap any coloured street for details.
            </div>

            <div className="mt-8 flex items-center justify-between gap-4">
              <button
                type="button"
                onClick={onSkip}
                className="rounded-full border border-gray-300 bg-white px-5 py-3 text-sm font-bold text-gray-500 shadow-sm transition hover:border-gray-400 cursor-pointer"
              >
                Skip
              </button>
              <button
                type="button"
                onClick={handlePressureDone}
                className="rounded-full border border-brand bg-brand px-6 py-3 text-sm font-bold text-white shadow-card cursor-pointer hover:bg-brand-light transition-colors"
              >
                Got it
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

