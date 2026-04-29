/**
 * "Parking Sign Translator" section matching the provided screenshots.
 *
 * Renders the schedule segments returned by backend `translator_rules`.
 */
export default function ParkingSignTranslator({ evaluation }) {
  const rules = Array.isArray(evaluation?.translator_rules) ? evaluation.translator_rules : []

  return (
    <div className="px-5 mt-6 pb-6">
      <div className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">
        Parking Sign Translator
      </div>

      <div className="rounded-2xl bg-gray-50 dark:bg-gray-800/50 p-3 space-y-2">
        {rules.length ? (
          rules.map((r, idx) => {
            const isCurrent = r.state === 'current'
            const isUpcoming = r.state === 'upcoming'

            const cardTone = isCurrent
              ? 'bg-blue-100/80 border border-blue-200'
              : 'bg-white/70 border border-gray-200'

            const bannerTone = isCurrent
              ? 'text-red-600'
              : isUpcoming
                ? 'text-gray-500'
                : null

            return (
              <div key={`${r.heading}-${idx}`} className={`rounded-xl px-4 py-3 ${cardTone}`}>
                {r.banner && bannerTone && (
                  <div className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${bannerTone}`}>
                    {r.banner}
                  </div>
                )}
                <div className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                  {r.heading}
                </div>
                <div className="text-[11px] text-gray-600 dark:text-gray-300 mt-0.5 leading-relaxed">
                  {r.body}
                </div>
              </div>
            )
          })
        ) : (
          <div className="rounded-xl bg-white/70 border border-gray-200 px-4 py-3 text-xs text-gray-600 dark:text-gray-300">
            No rule breakdown available. Check posted signage.
          </div>
        )}
      </div>
    </div>
  )
}

