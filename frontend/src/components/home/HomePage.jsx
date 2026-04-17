import { useState } from 'react'
import { FACT_CARDS } from '../../data/mapData'
import { cn } from '../../utils/cn'
import SiteFooter from '../layout/SiteFooter'

const FACT_COLORS = {
  green: 'border-l-brand',
  teal: 'border-l-cyan-600',
  amber: 'border-l-amber-500',
  red: 'border-l-danger',
}

const IconCar = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 17h14M5 17a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1l2-3h8l2 3h1a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2M5 17v1a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-1M19 17v1a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-1" />
  </svg>
)
const IconLeaf = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22c-4-4-8-7.5-8-12a8 8 0 0 1 16 0c0 4.5-4 8-8 12Z" />
    <path d="M12 10v6M9 13h6" />
  </svg>
)
const IconSignal = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 20h.01M7 20v-4M12 20v-8M17 20V8M22 20V4" />
  </svg>
)
const IconBuilding = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="2" width="16" height="20" rx="1" />
    <path d="M9 22V12h6v10M8 6h.01M16 6h.01M12 6h.01M8 10h.01M16 10h.01M12 10h.01" />
  </svg>
)
const IconParking = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="3" />
    <path d="M9 17V7h4a3 3 0 0 1 0 6H9" />
  </svg>
)

const WHY_CARDS = [
  { icon: <IconCar />,      title: 'Reduced Congestion',       body: "Drivers spend an average of 17 minutes cruising for parking in Melbourne's CBD. MeloPark guides you to available bays in real time, slashing that wasted time \u2013 and the traffic it creates." },
  { icon: <IconLeaf />,     title: 'Lower Emissions',          body: "Every minute a car cruises for parking releases unnecessary CO\u2082. By reducing search time, MeloPark directly cuts vehicle emissions \u2013 supporting Melbourne's net-zero targets by 2040." },
  { icon: <IconSignal />,   title: 'Predictive Intelligence',  body: "We don't just show you what's available now \u2013 our models predict which bays will free up in the next 30 minutes, so you can plan your journey before leaving home." },
  { icon: <IconBuilding />, title: 'Better City Utilisation',  body: "Melbourne already has the infrastructure. MeloPark makes it smarter \u2013 no new construction required. Existing sensors, existing bays, better outcomes for everyone." },
  { icon: <IconParking />,  title: 'Plain-English restrictions', body: "Raw codes such as 2P Meter 8\u201318 Mon\u2013Fri become clear wording: 2-hour parking, Mon\u2013Fri 8 am\u20136 pm, pay by meter. Parking signage is notoriously confusing; MeloPark decodes it so you do not have to." },
]

function SectionLabel({ children }) {
  return (
    <span className="inline-block text-[11px] font-semibold uppercase tracking-wider text-brand-dark dark:text-brand-light bg-brand-50 dark:bg-brand-900/40 px-3 py-1 rounded-full mb-3">
      {children}
    </span>
  )
}

function HoverCard({ children, className }) {
  return (
    <div className={cn(
      'bg-white dark:bg-surface-dark-secondary rounded-2xl p-7 border border-gray-200/60 dark:border-gray-700/60 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-lg',
      className,
    )}>
      {children}
    </div>
  )
}

export default function HomePage({ availableBayCount, totalFreeSpots, onNavigate }) {
  return (
    <div className="pt-16">
      {/* Hero */}
      <section className="bg-gradient-to-br from-brand-50 via-white to-blue-50 dark:from-surface-dark dark:via-surface-dark-secondary dark:to-surface-dark px-6 pt-[72px] pb-14 text-center border-b border-gray-200/60 dark:border-gray-700/60">
        <div className="max-w-[600px] mx-auto">
          <div className="inline-flex items-center gap-2 bg-brand-50 dark:bg-brand-900/40 border border-brand/20 rounded-full px-4 py-1.5 mb-5 text-sm font-medium text-brand-dark dark:text-brand-light">
            <span className="w-1.5 h-1.5 bg-brand rounded-full" />
            Smarter Parking &middot; Cleaner City &middot; Reducing Emissions
          </div>
          <h1 className="text-[clamp(28px,5vw,48px)] font-extrabold text-gray-900 dark:text-white leading-tight mb-3.5 tracking-tight">
            Melbourne&rsquo;s <span className="text-brand">Intelligent</span> Parking Platform
          </h1>
          <p className="text-base text-gray-500 dark:text-gray-400 leading-relaxed mb-7">
            Transforming Melbourne&rsquo;s existing infrastructure data into real-time, predictive parking intelligence &ndash; reducing congestion, lowering carbon emissions and getting you parked faster.
          </p>
          <button
            onClick={() => onNavigate('map')}
            className="bg-brand hover:bg-brand-light text-white border-none rounded-xl px-7 py-3 text-[15px] font-semibold cursor-pointer font-sans transition-all hover:-translate-y-0.5"
          >
            ● View Live Map
          </button>
        </div>
      </section>

      {/* Stats bar */}
      <div className="bg-white dark:bg-surface-dark-secondary grid grid-cols-2 sm:grid-cols-5 border-b border-gray-200/60 dark:border-gray-700/60">
        {[
          { num: '31K+',           label: 'Bays Tracked' },
          { num: availableBayCount, label: 'Available Now' },
          { num: '27%',            label: 'Less Cruising' },
          { num: '4.3t',           label: 'CO\u2082 Saved Daily' },
          { num: totalFreeSpots,   label: 'Free Spots Now' },
        ].map((s, i) => (
          <div
            key={i}
            className="py-5 px-3 text-center border-r border-gray-200/60 dark:border-gray-700/60 last:border-r-0"
          >
            <div className="text-2xl font-extrabold text-brand tracking-tight">{s.num}</div>
            <div className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5 font-medium">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Why MeloPark */}
      <div className="px-6 py-14 max-w-[1100px] mx-auto">
        <SectionLabel>Why MeloPark</SectionLabel>
        <h2 className="text-[clamp(22px,3.5vw,34px)] font-extrabold text-gray-900 dark:text-white mb-2 tracking-tight">
          The parking problem is a climate problem
        </h2>
        <p className="text-[15px] text-gray-500 dark:text-gray-400 leading-relaxed mb-8">
          30% of urban traffic is drivers circling for parking. We fix that &ndash; one bay at a time.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {WHY_CARDS.map((c, i) => (
            <HoverCard key={i}>
              <div className="w-11 h-11 rounded-xl bg-brand-50 dark:bg-brand-900/40 flex items-center justify-center text-brand-dark dark:text-brand-light mb-3.5">
                {c.icon}
              </div>
              <h3 className="text-base font-bold mb-2 text-gray-900 dark:text-white">{c.title}</h3>
              <p className="text-sm leading-relaxed text-gray-500 dark:text-gray-400">{c.body}</p>
            </HoverCard>
          ))}
        </div>
      </div>

      {/* Live Dashboard */}
      <div className="px-6 pb-14 max-w-[1100px] mx-auto">
        <SectionLabel>Live Dashboard</SectionLabel>
        <h2 className="text-[clamp(22px,3.5vw,34px)] font-extrabold text-gray-900 dark:text-white mb-2 tracking-tight">
          Parking at a glance
        </h2>
        <p className="text-[15px] text-gray-500 dark:text-gray-400 leading-relaxed mb-7">
          Real-time snapshot of Melbourne CBD parking conditions.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {[
            { label: 'Available Bays',    num: availableBayCount, sub: 'of 9 total monitored',       badge: '\u2191 3 freed in last 10 min', up: true },
            { label: 'Avg Search Time',   num: '8min',            sub: 'was 17 min before MeloPark', badge: '\u2193 53% improvement',         up: true },
            { label: 'Rule Traps Active', num: '2',               sub: 'clearway or time-limited',   badge: '\u26a0 Check before parking',    up: false },
            { label: 'Free Spots Now',    num: totalFreeSpots,    sub: 'across available bays',      badge: 'Live sensor count',              up: true },
          ].map((d, i) => (
            <div
              key={i}
              className="bg-white dark:bg-surface-dark-secondary rounded-xl p-5 border border-gray-200/60 dark:border-gray-700/60"
            >
              <div className="text-[11px] text-gray-400 dark:text-gray-500 font-semibold uppercase tracking-wider mb-2">
                {d.label}
              </div>
              <div className={cn(
                'text-3xl font-extrabold tracking-tight',
                d.label === 'Rule Traps Active' ? 'text-trap' : 'text-gray-900 dark:text-white',
              )}>
                {d.num}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{d.sub}</div>
              <div
                className={cn(
                  'inline-flex items-center gap-1 text-[11px] font-semibold mt-2.5 px-2 py-0.5 rounded-full',
                  d.up
                    ? 'bg-brand-50 dark:bg-brand-900/40 text-brand-dark dark:text-brand-light'
                    : 'bg-trap-50 dark:bg-trap-500/10 text-amber-700 dark:text-trap-400',
                )}
              >
                {d.badge}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Fact Cards */}
      <div className="px-6 pb-14 max-w-[1100px] mx-auto">
        <SectionLabel>Did You Know?</SectionLabel>
        <h2 className="text-[clamp(22px,3.5vw,34px)] font-extrabold text-gray-900 dark:text-white mb-7 tracking-tight">
          The parking facts that matter
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FACT_CARDS.map((f, i) => (
            <HoverCard
              key={i}
              className={cn('border-l-4 pl-6', FACT_COLORS[f.color] || 'border-l-gray-300')}
            >
              <div className="text-4xl font-extrabold text-gray-900 dark:text-white leading-none tracking-tight">
                {f.num}<span className="text-lg text-brand">{f.unit}</span>
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400 mt-2 leading-relaxed">{f.desc}</div>
              <div className="text-[11px] text-gray-400 dark:text-gray-500 mt-2.5">Source: {f.source}</div>
            </HoverCard>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="bg-brand px-6 py-14 text-center">
        <div className="max-w-[480px] mx-auto">
          <h2 className="text-white text-[clamp(22px,3.5vw,32px)] font-extrabold tracking-tight mb-3">
            Ready to find your spot?
          </h2>
          <p className="text-white/85 text-[15px] mb-6 leading-relaxed">
            Open the live map and see exactly where you can park in Melbourne right now.
          </p>
          <button
            onClick={() => onNavigate('map')}
            className="bg-white text-brand border-none rounded-xl px-7 py-3 text-sm font-bold cursor-pointer font-sans hover:bg-brand-50 transition-colors"
          >
            Open Live Map &rarr;
          </button>
        </div>
      </div>

      <SiteFooter onNavigate={onNavigate} />
    </div>
  )
}
