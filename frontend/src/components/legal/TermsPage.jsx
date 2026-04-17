export default function TermsPage({ onNavigate }) {
  return (
    <main className="min-h-0 flex-1 overflow-auto bg-white px-10 pb-12 pt-20 text-gray-800 dark:bg-[#0a1628] dark:text-white/85">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white/90">Terms &amp; disclaimer</h1>
        <p className="mt-6 text-sm leading-relaxed text-gray-600 dark:text-white/55">
          MeloPark is provided for general information only. Bay availability, restrictions, and pricing
          information may be incomplete, delayed, or incorrect. Information is{' '}
          <strong className="font-medium text-gray-800 dark:text-white/75">indicative only</strong>.
        </p>
        <p className="mt-4 text-sm leading-relaxed text-gray-600 dark:text-white/55">
          Always follow on-street signage, ticket machines, and local laws. You are responsible for
          verifying that you may park legally before leaving your vehicle.
        </p>
        <p className="mt-8 text-xs text-gray-500 dark:text-white/40">
          Full terms of service may be published here in a future release.
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
