<<<<<<< HEAD
export default function AboutPage({ onNavigate }) {
  const year = new Date().getFullYear()

  return (
    <div className="min-h-0 flex-1 bg-white dark:bg-surface-dark overflow-y-auto">
      <div className="mx-auto w-full max-w-4xl px-5 py-8 sm:px-8 sm:py-10">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">About MeloPark</h1>
        <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
          MeloPark helps drivers find nearby bays, check live availability, and view parking rules before they park.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <section className="rounded-xl border border-gray-200/80 bg-white p-4 dark:border-gray-700 dark:bg-surface-dark-secondary">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Product</h2>
            <div className="mt-2 flex flex-col gap-2 text-sm">
              <button type="button" onClick={() => onNavigate?.('map')} className="text-left text-brand hover:underline">
                Live map
              </button>
              <a href="https://data.melbourne.vic.gov.au/" target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">
                Data sources
              </a>
            </div>
          </section>

          <section className="rounded-xl border border-gray-200/80 bg-white p-4 dark:border-gray-700 dark:bg-surface-dark-secondary">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Resources</h2>
            <div className="mt-2 flex flex-col gap-2 text-sm">
              <a href="https://github.com/ssud0016-ds/melopark" target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">
                GitHub
              </a>
              <a href="https://www.w3.org/WAI/fundamentals/accessibility-intro/" target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">
                Accessibility
              </a>
              <a href="mailto:contact@melopark.app" className="text-brand hover:underline">
                Contact
              </a>
            </div>
          </section>

          <section className="rounded-xl border border-gray-200/80 bg-white p-4 dark:border-gray-700 dark:bg-surface-dark-secondary sm:col-span-2">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Legal</h2>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-sm">
              <button type="button" onClick={() => onNavigate?.('about')} className="text-brand hover:underline">
                Privacy
              </button>
              <button type="button" onClick={() => onNavigate?.('terms')} className="text-brand hover:underline">
                Terms
              </button>
              <button type="button" onClick={() => onNavigate?.('attribution')} className="text-brand hover:underline">
                Attribution
              </button>
            </div>
          </section>
        </div>

        <div className="mt-8 border-t border-gray-200 pt-4 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
          <p>&copy; {year} MeloPark · Melbourne, Australia</p>
          <p className="mt-1">
            Parking data by{' '}
            <a href="https://data.melbourne.vic.gov.au/" target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">
              City of Melbourne
            </a>{' '}
            under{' '}
            <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">
              CC BY 4.0
            </a>
            .
          </p>
        </div>
=======
import SiteFooter from '../layout/SiteFooter'

const PAIN_POINTS = [
  { value: '30 Minutes +', desc: 'spent circling for a spot' },
  { value: '$350 +', desc: 'average parking fines' },
  { value: '30 %', desc: 'of CBD traffic is just cruising' },
]

const FRICTION_CARDS = [
  {
    title: 'Confusing Signs',
    desc: '"2P Meter 8-4 Mon-Fri" - What does that mean?',
  },
  {
    title: 'Hidden Rule Traps',
    desc: '"Park legally at 4PM, tow away zone at 4:15"',
  },
]

const FIX_CARDS = [
  { title: 'Live availability', desc: 'Real-time sensor data', icon: 'sun' },
  { title: 'Clear rules', desc: 'Complex signs decoded to English', icon: 'rule' },
  { title: 'Trap alerts', desc: 'Clear warnings before you are fined', icon: 'alert' },
  { title: 'Search & go', desc: 'Find bays near any address', icon: 'search' },
]

function FeatureIcon({ type }) {
  if (type === 'rule') {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path d="M8 7h8M8 11h8M8 15h5" />
      </svg>
    )
  }

  if (type === 'alert') {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 3l9 4.5v6c0 5-3.5 7.5-9 9-5.5-1.5-9-4-9-9v-6L12 3z" />
        <path d="M12 9v4M12 17h.01" />
      </svg>
    )
  }

  if (type === 'search') {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3.5-3.5" />
      </svg>
    )
  }

  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 6v6l4 2" />
    </svg>
  )
}

export default function AboutPage({ onNavigate }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-white dark:bg-surface-dark">
      <div className="pt-16">
        <section className="bg-brand px-5 pb-14 pt-12 text-center sm:px-8">
          <div className="mx-auto max-w-[760px]">
            <div className="inline-flex items-center rounded-full border border-white/30 bg-white/10 px-4 py-1.5 text-xs font-semibold tracking-wide text-white/90">
              Smarter parking - Cleaner city - Reducing emissions
            </div>
            <h1 className="mt-6 text-[clamp(34px,6vw,58px)] font-extrabold leading-tight tracking-tight text-white">
              Melbourne&apos;s <span className="text-accent">Intelligent</span> Parking Platform
            </h1>
            <p className="mx-auto mt-4 max-w-[680px] text-base leading-relaxed text-white/90 sm:text-lg">
              Real-time parking intelligence for Melbourne CBD. Find available bays, check parking rules, and avoid fines even before you even leave home.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => onNavigate?.('map')}
                className="rounded-xl border-none bg-accent px-7 py-2.5 text-sm font-bold text-brand-dark transition-colors hover:bg-accent-400"
              >
                Find parking now
              </button>
              <button
                type="button"
                onClick={() => onNavigate?.('map')}
                className="rounded-xl border border-white/40 bg-transparent px-7 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
              >
                Learn more
              </button>
            </div>
          </div>
        </section>

        <section className="bg-white px-5 py-12 sm:px-8">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-center text-[30px] font-extrabold tracking-tight text-brand-dark dark:text-white sm:text-[38px]">
              Parking in Melbourne is painful
            </h2>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {PAIN_POINTS.map((point) => (
                <article key={point.value} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                  <p className="text-[32px] font-extrabold tracking-tight text-brand-dark">{point.value}</p>
                  <p className="mt-1 text-sm text-gray-500">{point.desc}</p>
                </article>
              ))}
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {FRICTION_CARDS.map((item) => (
                <article key={item.title} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                  <h3 className="text-2xl font-bold tracking-tight text-brand-dark">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-gray-500">{item.desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-white px-5 py-12 sm:px-8">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-center text-[30px] font-extrabold tracking-tight text-brand-dark dark:text-white sm:text-[38px]">
              MeloPark fixes this
            </h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {FIX_CARDS.map((card) => (
                <article key={card.title} className="rounded-2xl border border-gray-200 bg-brand-50/40 p-5 text-center shadow-sm">
                  <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-white text-brand">
                    <FeatureIcon type={card.icon} />
                  </div>
                  <h3 className="mt-4 text-base font-bold text-brand-dark">{card.title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-gray-500">{card.desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-brand px-5 py-12 text-center sm:px-8">
          <h2 className="text-[30px] font-extrabold tracking-tight text-white sm:text-[42px]">
            Stop Circling. Start Parking
          </h2>
          <button
            type="button"
            onClick={() => onNavigate?.('map')}
            className="mt-6 rounded-xl border-none bg-accent px-8 py-2.5 text-sm font-bold text-brand-dark transition-colors hover:bg-accent-400"
          >
            Find Parking Now
          </button>
        </section>

        <SiteFooter onNavigate={onNavigate} />
>>>>>>> origin/main
      </div>
    </div>
  )
}
