import { cn } from '../../utils/cn'

export default function VerdictCard({ bay }) {
  const isTrap = bay.type === 'trap'
  const isAvailable = bay.type === 'available'

  return (
    <div
      className={cn(
        'rounded-xl p-4 border',
        isAvailable && 'bg-brand-50 border-brand-200 dark:bg-brand-900/30 dark:border-brand-700',
        isTrap && 'bg-trap-50 border-trap-200 dark:bg-trap-500/10 dark:border-trap-400/40',
        !isAvailable && !isTrap && 'bg-danger-50 border-danger-200 dark:bg-danger-500/10 dark:border-danger-400/40',
      )}
    >
      <div className="flex items-center justify-between gap-3 mb-2">
        <span
          className={cn(
            'text-sm font-bold',
            isAvailable && 'text-brand-dark dark:text-brand-light',
            isTrap && 'text-trap dark:text-trap-400',
            !isAvailable && !isTrap && 'text-danger dark:text-danger-400',
          )}
        >
          {isAvailable ? 'Safe to Park' : isTrap ? 'Rule Trap' : 'Occupied'}
        </span>
        <span className="text-xs text-gray-500 dark:text-gray-400">{bay.limitType?.toUpperCase()}</span>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {[
          { label: 'Safe', value: bay.safe },
          { label: 'Time Limit', value: bay.limit },
          { label: 'Cost', value: bay.cost },
          { label: 'Applies', value: bay.applies },
        ].map((row) => (
          <div key={row.label} className="bg-white/60 dark:bg-white/5 rounded-lg px-3 py-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
              {row.label}
            </div>
            <div className="text-xs font-semibold text-gray-900 dark:text-gray-100 mt-0.5 break-words">
              {row.value ?? '\u2014'}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
