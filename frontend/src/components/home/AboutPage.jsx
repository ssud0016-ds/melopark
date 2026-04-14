import { cn } from '../../utils/cn'

const DATA_SOURCES = [
  { name: 'On-street Parking Bay Sensors', type: 'Real-time', use: 'Live bay occupancy' },
  { name: 'On-street Parking Bays', type: 'Static', use: 'Bay geometry and locations' },
  { name: 'On-street Car Park Bay Restrictions', type: 'Static', use: 'Parking rules and time limits' },
  { name: 'On-street Car Parking Meters with Location', type: 'Static', use: 'Pricing and payment info' },
]

const TEAM_MEMBERS = [
  'Prashant Thakur',
  'Sanjay Sanjay',
  'Yifei Zhu',
  'Syed Mohammed Ali Fatimi',
  'Sai Nikitha Damera',
]

export default function AboutPage({ onNavigate }) {
  return (
    <div className="pt-16 min-h-screen bg-gray-50 dark:bg-surface-dark">
      <div className="max-w-[720px] mx-auto px-6 py-14">

        {/* Header */}
        <h1 className="text-[clamp(28px,5vw,40px)] font-extrabold text-gray-900 dark:text-white tracking-tight mb-2">
          About Melo<span className="text-brand">Park</span>
        </h1>
        <p className="text-base text-gray-500 dark:text-gray-400 mb-10 leading-relaxed">
          Melbourne&rsquo;s real-time parking decision-support tool.
        </p>

        {/* What is MeloPark */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3">What is MeloPark?</h2>
          <p className="text-[15px] text-gray-600 dark:text-gray-400 leading-relaxed">
            MeloPark is a parking assistance platform for Melbourne CBD. It shows real-time bay
            availability using data from City of Melbourne in-ground sensors, translates complex
            parking restrictions into plain English, and warns you about rule traps like clearways
            or tow zones that could catch you off guard.
          </p>
        </section>

        {/* Why we built this */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3">Why we built this</h2>
          <p className="text-[15px] text-gray-600 dark:text-gray-400 leading-relaxed">
            Drivers unfamiliar with Melbourne&rsquo;s CBD often struggle to find parking, understand
            confusing signage, and avoid fines from time-limited or restricted bays. The information
            exists across multiple City of Melbourne datasets, but it&rsquo;s scattered and hard to
            use in the moment. MeloPark brings it all together into a single map-based interface
            that answers one question: <strong className="text-gray-900 dark:text-white">&ldquo;Can I park here, right now, legally, for how long, and at what cost?&rdquo;</strong>
          </p>
        </section>

        {/* Team */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3">Team FlaminGO</h2>
          <p className="text-[15px] text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
            Built as part of <strong className="text-gray-700 dark:text-gray-300">FIT5120 Industry Experience Studio</strong> at
            Monash University, Semester 1 2026.
          </p>
          <div className="flex flex-wrap gap-2">
            {TEAM_MEMBERS.map((name) => (
              <span
                key={name}
                className="bg-white dark:bg-surface-dark-secondary border border-gray-200/60 dark:border-gray-700/60 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                {name}
              </span>
            ))}
          </div>
        </section>

        {/* Data sources */}
        <section className="mb-12">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3">Data Sources</h2>
          <p className="text-[15px] text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
            All data from the{' '}
            <a
              href="https://data.melbourne.vic.gov.au/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand hover:underline font-medium"
            >
              City of Melbourne Open Data Portal
            </a>{' '}
            under CC BY licence.
          </p>
          <div className="grid gap-2.5">
            {DATA_SOURCES.map((ds) => (
              <div
                key={ds.name}
                className="bg-white dark:bg-surface-dark-secondary border border-gray-200/60 dark:border-gray-700/60 rounded-xl px-4 py-3 flex items-start gap-3"
              >
                <span className={cn(
                  'shrink-0 mt-0.5 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full',
                  ds.type === 'Real-time'
                    ? 'bg-brand-50 dark:bg-brand-900/40 text-brand-dark dark:text-brand-light'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400',
                )}>
                  {ds.type}
                </span>
                <div>
                  <div className="text-sm font-semibold text-gray-900 dark:text-white">{ds.name}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{ds.use}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Back to map */}
        <div className="text-center mb-10">
          <button
            onClick={() => onNavigate('map')}
            className="bg-brand hover:bg-brand-light text-white border-none rounded-xl px-7 py-3 text-[15px] font-semibold cursor-pointer font-sans transition-all hover:-translate-y-0.5"
          >
            &larr; Back to Live Map
          </button>
        </div>

        {/* Footer */}
        <footer className="text-center text-sm text-gray-400 dark:text-gray-500 pt-6 border-t border-gray-200/60 dark:border-gray-700/60">
          &copy; 2026 MeloPark &middot; Melbourne, Victoria, Australia
        </footer>
      </div>
    </div>
  )
}
