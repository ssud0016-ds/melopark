import { useState, useEffect } from 'react'

/**
 * OnboardingOverlay — Round 3 update.
 *
 * Step 0 (hero): unchanged from round 2.
 * Step 1 (destination): slim bottom-anchored prompt card.
 *   The real ChromeSearchBar at the top of the viewport (z-[1000]) remains
 *   interactive because it is above this overlay (z-[800]). The pulsing ring
 *   on ChromeSearchBar is driven by the `onboardingActive` prop that MapPage
 *   passes down — no ring logic needed here.
 * Step 2 (legend / "pressure"): unchanged from round 2.
 */
export default function OnboardingOverlay({ onPick, onSkip, busyNowManifest, onStepChange }) {
  const [step, setStep] = useState('hero')
  const [localDestination, setLocalDestination] = useState(null)

  useEffect(() => {
    onStepChange?.(step)
  }, [step, onStepChange])

  // Register setter so MapPage can push picked destination into this component
  useEffect(() => {
    _onboardingDestinationSetter = setLocalDestination
    return () => { _onboardingDestinationSetter = null }
  }, [])

  const hasPressureData = busyNowManifest != null && (busyNowManifest.total_segments ?? 0) > 0

  const handleStart = () => setStep('destination')

  const handleContinue = () => {
    if (!localDestination) return
    if (hasPressureData && step === 'destination') {
      setStep('pressure')
      return
    }
    onPick(localDestination, null, {
      statusFilter: 'all',
      durationFilter: null,
      customDuration: null,
      accessible: false,
    })
  }

  const handlePressureDone = () => {
    onPick(localDestination, null, {
      statusFilter: 'all',
      durationFilter: null,
      customDuration: null,
      accessible: false,
    })
  }

  // Called from MapPage when the ChromeSearchBar picks a destination during onboarding
  // (MapPage wires onboardingActive and passes the pick up via handleOnboardingPick)
  // This component does NOT render its own SearchBar — it uses the real top chrome.

  if (step === 'hero') {
    return (
      <div
        className="absolute inset-0 z-[800] flex items-center justify-center bg-black/30 backdrop-blur-[2px] px-6"
        role="dialog"
        aria-modal="true"
        aria-label="Welcome to MelOPark"
      >
        <div className="w-full max-w-md rounded-3xl bg-brand-900 shadow-card-lg p-7 sm:p-8">
          <div className="text-white text-lg font-semibold">Welcome to</div>
          <div className="mt-1 flex items-center gap-3">
            <div className="text-[44px] leading-none font-extrabold tracking-tight text-white">
              MelO<span className="text-accent">Park</span>
            </div>
            <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="w-9 h-9 text-white/80">
              <path d="M5 17H3v-5l2-5h14l2 5v5h-2"/>
              <circle cx="7.5" cy="17" r="1.5"/>
              <circle cx="16.5" cy="17" r="1.5"/>
              <path d="M5 12h14"/>
            </svg>
          </div>
          <div className="mt-4 text-sm leading-relaxed text-white/80">
            This app helps you find nearby parking bays, check availability, and view parking rules before you park.
          </div>
          <div className="mt-5 text-sm font-semibold text-accent">Stop Circling — Start Parking</div>
          <button
            type="button"
            onClick={handleStart}
            className="mt-10 w-full rounded-full bg-accent px-6 py-4 text-sm font-extrabold text-brand-dark shadow-card cursor-pointer hover:brightness-95 transition"
          >
            Let&apos;s get started now
          </button>
        </div>
      </div>
    )
  }

  if (step === 'destination') {
    // Slim bottom card — the real search bar (above this overlay, z-[1000]) is
    // the actual interactive element. User searches there; when a destination is
    // picked MapPage calls handleOnboardingPick which also calls onPick here via
    // the onboardingActive prop chain.
    //
    // We expose a callback for MapPage to pass back the picked destination so
    // the Next button can enable. MapPage does this via onboardingActive + the
    // fact that ChromeSearchBar calls the normal onPick on the map which
    // MapPage intercepts when showOnboarding is true (see handleOnboardingPick).
    //
    // For this component, we just watch the `destination` prop that MapPage passes.
    // Since MapPage's destination is set when the user picks, we can read it here
    // via a ref pattern. Simplest: MapPage passes a `pickedDestination` prop.
    // We don't have that here — the parent wires it. For now, expose
    // setLocalDestination so MapPage can call it.
    return (
      <div
        className="absolute inset-0 z-[800] bg-black/35 dark:bg-black/55 backdrop-blur-[2px]"
        role="dialog"
        aria-modal="true"
        aria-label="Choose your destination"
      >
        {/* Bottom prompt card — anchored to bottom, above the map blur */}
        <div className="absolute bottom-0 left-0 right-0 bg-white dark:bg-surface-dark-secondary rounded-t-2xl shadow-sheet px-5 pt-5 pb-6 sm:pb-8">
          <div className="mb-1 text-[34px] font-extrabold tracking-tight text-brand dark:text-brand-light leading-tight">
            Where are<br />you going?
          </div>
          <div className="mb-5 text-sm text-gray-500 dark:text-gray-400">
            Search for your destination above to find free nearby parking bays.
          </div>
          <div className="flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={onSkip}
              className="text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors cursor-pointer underline-offset-2 hover:underline"
            >
              Skip, just show map
            </button>
            <button
              type="button"
              onClick={handleContinue}
              disabled={!localDestination}
              className="rounded-full border border-brand bg-brand px-6 py-3 text-sm font-bold text-white shadow-card cursor-pointer hover:bg-brand-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
            >
              {hasPressureData ? 'Next →' : 'Continue →'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Step 'pressure' — legend / what you'll see on the map (unchanged from round 2)
  return (
    <div
      className="absolute inset-0 z-[800] flex items-center justify-center bg-black/35 dark:bg-black/55 backdrop-blur-[2px] px-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="What you'll see on the map"
    >
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-surface-dark-secondary shadow-card-lg border border-gray-200/60 dark:border-gray-700/60 p-5 sm:p-6 my-6">
        <div className="mb-2 text-[26px] font-bold tracking-tight text-brand">
          What you&apos;ll see on the map
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
              <span className="h-1.5 w-8 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden />
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
      </div>
    </div>
  )
}

// Re-export setLocalDestination mechanism: MapPage calls this imperative handle
// so the "Next" button in step 1 enables when the search bar picks a destination.
// We use a module-level callback pattern so MapPage can wire it without prop drilling.
let _onboardingDestinationSetter = null
export function setOnboardingDestination(dest) {
  if (_onboardingDestinationSetter) _onboardingDestinationSetter(dest)
}
