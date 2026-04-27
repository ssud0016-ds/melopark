import { cn } from '../../utils/cn'
import { COMBINED_COLORS } from '../../utils/bayCombinedStatus'

function HeroIcon({ word, className }) {
  if (word === 'YES') {
    return (
      <svg className={className} width="36" height="36" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M5 12.5l4.5 4.5L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  if (word === 'NO') {
    return (
      <svg className={className} width="36" height="36" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    )
  }
  return (
    <svg className={className} width="36" height="36" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M9 9a3 3 0 1 1 4.6 2.5c-1 .7-1.6 1.4-1.6 2.5" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="18" r="1.1" fill="currentColor" />
    </svg>
  )
}

/**
 * Hero verdict block. Word + icon + sentence on a tinted panel.
 * Not interactive (taps do nothing) so it cannot accidentally dismiss the sheet.
 *
 * Props:
 *   combined   - object from combinedStatus() with { heroWord, heroSentence, color }
 *   loading    - true while evaluation is in flight
 */
export default function HeroVerdict({ combined, loading = false }) {
  const word = loading ? 'CHECK' : (combined?.heroWord ?? 'CHECK')
  const sentence = loading ? 'Checking rules' : (combined?.heroSentence ?? 'No data. Read the sign')
  const colorKey = loading ? 'grey' : (combined?.color ?? 'grey')
  const palette = COMBINED_COLORS[colorKey] || COMBINED_COLORS.grey

  return (
    <div
      className={cn('px-5 py-6 flex items-center gap-4', palette.bg)}
      aria-live="polite"
      role="status"
    >
      <HeroIcon word={word} className={cn('shrink-0', palette.text)} />
      <div className="min-w-0">
        <div className={cn('text-4xl font-extrabold tracking-tight leading-none', palette.text)}>
          {word}
        </div>
        <div className={cn('mt-1.5 text-sm font-semibold', palette.textMuted)}>
          {sentence}
        </div>
      </div>
    </div>
  )
}
