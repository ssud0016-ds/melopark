/**
 * Three fixed constraint chips: STAY LIMIT, COST, ENDS.
 *
 * Always renders 3 slots (placeholder when value missing) so the eye learns
 * positions. Whole row is hidden only when all three values are absent.
 *
 * Props:
 *   stayLimit - string | null (e.g. "2 hr", "Unlimited")
 *   cost      - string | null (e.g. "Free", "Check meter")
 *   endsAt    - string | null (e.g. "6:30 PM", "No limit")
 */
export default function ConstraintChips({ stayLimit, cost, endsAt }) {
  const slots = [
    { label: 'Stay limit', value: stayLimit },
    { label: 'Cost', value: cost },
    { label: 'Ends', value: endsAt },
  ]
  const allEmpty = slots.every((s) => !s.value)
  if (allEmpty) return null

  return (
    <div
      role="list"
      className="grid grid-cols-3 gap-2 px-5 py-3 border-y border-gray-200/60 dark:border-gray-700/60"
    >
      {slots.map((s) => (
        <div
          key={s.label}
          role="listitem"
          className="min-h-[44px] rounded-lg bg-surface-secondary px-2.5 py-2 dark:bg-surface-dark-tertiary"
        >
          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            {s.label}
          </div>
          <div className="mt-0.5 text-sm font-semibold text-gray-900 dark:text-gray-100 tabular-nums">
            {s.value || '-'}
          </div>
        </div>
      ))}
    </div>
  )
}
