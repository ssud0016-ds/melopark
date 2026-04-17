export default function AttributionPage({ onNavigate }) {
  return (
    <main className="min-h-0 flex-1 overflow-auto bg-white px-10 pb-12 pt-20 text-gray-800 dark:bg-[#0a1628] dark:text-white/85">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white/90">Attribution</h1>
        <p className="mt-6 text-sm leading-relaxed text-gray-600 dark:text-white/55">
          Parking data is sourced from the{' '}
          <a
            href="https://data.melbourne.vic.gov.au/"
            className="text-brand underline decoration-brand/30 underline-offset-2 hover:text-brand-dark dark:text-brand-light"
            target="_blank"
            rel="noopener noreferrer"
          >
            City of Melbourne Open Data Portal
          </a>{' '}
          and used under the{' '}
          <a
            href="https://creativecommons.org/licenses/by/4.0/"
            className="text-brand underline decoration-brand/30 underline-offset-2 hover:text-brand-dark dark:text-brand-light"
            target="_blank"
            rel="noopener noreferrer"
          >
            Creative Commons Attribution 4.0 International (CC BY 4.0)
          </a>{' '}
          licence.
        </p>
        <h2 className="mt-8 text-sm font-semibold text-gray-900 dark:text-white/80">Map tiles</h2>
        <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-white/55">
          Basemap tiles are provided by{' '}
          <a
            href="https://www.openstreetmap.org/copyright"
            className="text-brand underline decoration-brand/30 underline-offset-2 hover:text-brand-dark dark:text-brand-light"
            target="_blank"
            rel="noopener noreferrer"
          >
            OpenStreetMap
          </a>{' '}
          contributors, rendered by{' '}
          <a
            href="https://carto.com/attributions"
            className="text-brand underline decoration-brand/30 underline-offset-2 hover:text-brand-dark dark:text-brand-light"
            target="_blank"
            rel="noopener noreferrer"
          >
            CARTO
          </a>
          . Attribution also appears on the live map.
        </p>
        <p className="mt-8">
          <button
            type="button"
            onClick={() => onNavigate?.('map')}
            className="text-sm font-medium text-brand hover:text-brand-dark dark:text-brand-light dark:hover:text-white"
          >
            &larr; Back to live map
          </button>
        </p>
      </div>
    </main>
  )
}
