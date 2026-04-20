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
      </div>
    </div>
  )
}
