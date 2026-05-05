import { useEffect, useRef, useState } from 'react'
import { cn } from '../../utils/cn'

const TABS = [
  { id: 'map', label: 'Map' },
  { id: 'pressure', label: 'Parking Pressure' },
  { id: 'filters', label: 'Filters' },
  { id: 'bay', label: 'Bay Details' },
]

function StreetLine({ color }) {
  return (
    <span
      className="inline-block h-1.5 w-6 shrink-0 rounded-full align-middle"
      style={{ backgroundColor: color }}
      aria-hidden
    />
  )
}

function DotCircle({ color }) {
  return (
    <span
      className="inline-block h-3 w-3 shrink-0 rounded-full align-middle"
      style={{ backgroundColor: color }}
      aria-hidden
    />
  )
}

function Section({ title, children }) {
  return (
    <div className="mb-5">
      <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-brand dark:text-brand-100">{title}</div>
      <div className="space-y-1.5 text-sm text-gray-700 dark:text-gray-200">{children}</div>
    </div>
  )
}

function LegendRow({ left, label, sub }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 flex shrink-0 items-center">{left}</span>
      <span>
        <span className="font-medium">{label}</span>
        {sub && <span className="ml-1 text-gray-500 dark:text-gray-400">{sub}</span>}
      </span>
    </div>
  )
}

function TabMap() {
  return (
    <>
      <Section title="Bay colours">
        <LegendRow left={<DotCircle color="#22c55e" />} label="Green: available" sub="Bay is free right now" />
        <LegendRow left={<DotCircle color="#f97316" />} label="Orange: caution" sub="Tow away / loading zone risk" />
        <LegendRow left={<DotCircle color="#ef4444" />} label="Red: occupied" sub="Bay is taken" />
        <LegendRow
          left={
            <span className="flex h-3 w-3 items-center justify-center rounded-full bg-blue-400">
              <svg viewBox="0 0 24 24" className="h-2.5 w-2.5" fill="white" aria-hidden>
                <path d="M12 2c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2m9 7h-6v13h-2v-6h-2v6H9V9H3V7h18v2z"/>
              </svg>
            </span>
          }
          label="Blue person: accessible bay"
        />
      </Section>
      <Section title="Interacting">
        <p>Tap any bay dot to see its parking rules, time limits, and a verdict on whether it's safe to park.</p>
      </Section>
    </>
  )
}

function TabPressure() {
  return (
    <>
      <Section title="Street colours">
        <LegendRow left={<StreetLine color="#22c55e" />} label="Green" sub="Good chance of finding a spot" />
        <LegendRow left={<StreetLine color="#f97316" />} label="Orange" sub="Getting busy" />
        <LegendRow left={<StreetLine color="#ef4444" />} label="Red" sub="Hard to park right now" />
        <LegendRow left={<StreetLine color="#cbd5e1" />} label="Grey" sub="No live estimate for this street" />
      </Section>
      <Section title="Tap a coloured street">
        <p>Tap any coloured street to see free bays, pressure %, and nearby events affecting demand.</p>
      </Section>
      <Section title="Alternative Zones">
        <p>The panel shows quieter areas near your destination. Tap a zone card to fly the map there and see available bays.</p>
      </Section>
      <Section title="Quiet Streets">
        <p>Top 3 least-busy streets in the current map view. Tap to zoom in on any of them.</p>
      </Section>
      <Section title="Data sources">
        <LegendRow left={<span className="text-base">📡</span>} label="Live sensors" sub="City of Melbourne bay sensors, ~8 s refresh" />
        <LegendRow left={<span className="text-base">🚦</span>} label="SCATS" sub="Traffic signal historical profile" />
        <LegendRow left={<span className="text-base">🎭</span>} label="Events" sub="Active Melbourne events affecting demand" />
      </Section>
    </>
  )
}

function TabFilters() {
  return (
    <>
      <Section title="Status filter">
        <LegendRow left={<span className="text-[11px] font-bold text-brand">All</span>} label="Show every bay" />
        <LegendRow left={<span className="text-[11px] font-bold text-green-600">Available</span>} label="Only free bays right now" />
        <LegendRow left={<span className="text-[11px] font-bold text-blue-500">Accessible</span>} label="Disabled-permit bays only" />
        <LegendRow left={<span className="text-[11px] font-bold text-orange-500">Caution</span>} label="Tow away / loading zone risk only" />
      </Section>
      <Section title="Duration filter">
        <p>Shows only bays that are legally parkable for your chosen stay length. A 2H bay won't appear when you filter for 3H.</p>
      </Section>
      <Section title="Arrival time planner">
        <p>Set a date and time to evaluate parking rules at that moment - not live. Useful for planning ahead. A <strong>Planned</strong> badge appears when active.</p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Tap <em>Clear</em> to return to live mode.</p>
      </Section>
      <Section title='"Show all bays at this time"'>
        <p>Button inside the bay detail sheet - applies your planned time across the whole map so every bay reflects the rules at that time.</p>
      </Section>
    </>
  )
}

function TabBay() {
  return (
    <>
      <Section title="Verdict card">
        <LegendRow left={<span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-800">Yes to Park</span>} label="Safe to park now" />
        <LegendRow left={<span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-800">Caution</span>} label="Check the rules carefully" />
        <LegendRow left={<span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-800">Don't Park</span>} label="Not allowed right now" />
      </Section>
      <Section title="Sign Translator">
        <p>A plain-English breakdown of the parking sign rules for each bay - no decoding needed.</p>
      </Section>
      <Section title="Leave By time">
        <p>Shown when planning ahead. The latest time you must move your car to avoid a fine.</p>
      </Section>
    </>
  )
}

const TAB_CONTENT = {
  map: <TabMap />,
  pressure: <TabPressure />,
  filters: <TabFilters />,
  bay: <TabBay />,
}

export default function HelpModal({ onClose }) {
  const [activeTab, setActiveTab] = useState('map')
  const dialogRef = useRef(null)

  useEffect(() => {
    const el = dialogRef.current
    if (!el) return
    const focusable = el.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    )
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    first?.focus()

    const trap = (e) => {
      if (e.key === 'Tab') {
        if (e.shiftKey ? document.activeElement === first : document.activeElement === last) {
          e.preventDefault()
          ;(e.shiftKey ? last : first)?.focus()
        }
      }
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', trap)
    return () => document.removeEventListener('keydown', trap)
  }, [onClose])

  const replayOnboarding = () => {
    sessionStorage.clear()
    window.location.reload()
  }

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/40 backdrop-blur-[3px] px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Help"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        ref={dialogRef}
        className="relative w-full max-w-lg rounded-2xl bg-white dark:bg-surface-dark-secondary shadow-card-lg border border-gray-200/60 dark:border-gray-700/60 flex flex-col max-h-[90dvh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100 dark:border-gray-700/50 shrink-0">
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white">Help</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">How MelOPark works</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close help"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 hover:border-gray-300 dark:bg-surface-dark dark:border-slate-600 dark:text-gray-300 dark:hover:bg-surface-dark-secondary transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex shrink-0 gap-1 overflow-x-auto px-4 pt-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={cn(
                'shrink-0 rounded-full border px-3.5 py-1.5 text-[11px] font-semibold tracking-wide transition-colors whitespace-nowrap',
                activeTab === t.id
                  ? 'border-brand bg-brand text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300 dark:border-slate-600 dark:bg-surface-dark dark:text-gray-300 dark:hover:bg-surface-dark-secondary',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {TAB_CONTENT[activeTab]}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-gray-100 dark:border-gray-700/50 px-5 py-4">
          <button
            type="button"
            onClick={replayOnboarding}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-brand/40 bg-brand-50 px-4 py-2.5 text-sm font-semibold text-brand hover:bg-brand-100 dark:bg-brand/10 dark:border-brand/30 dark:text-brand-100 dark:hover:bg-brand/20 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M3 3v5h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Replay onboarding tutorial
          </button>
        </div>
      </div>
    </div>
  )
}
