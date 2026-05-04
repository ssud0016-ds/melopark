import { useCallback, useLayoutEffect, useRef } from 'react'
import { getStatusFillColor } from '../map/ParkingMap'
import EventBadge from './EventBadge'

const TREND_LABEL = { up: '↑ rising', down: '↓ falling', flat: '· steady' }
const TREND_ARIA = { up: 'rising', down: 'falling', flat: 'steady' }
const CHANCE_TEXT = {
  low: 'Good parking chance',
  medium: 'Getting busy',
  high: 'Hard to park',
  unknown: 'No live estimate',
}

function levelToTone(level) {
  if (level === 'high') return 'occupied'
  if (level === 'medium') return 'caution'
  if (level === 'low') return 'available'
  return 'unknown'
}

function coverageText(totalBays, hasLiveBays) {
  if (!hasLiveBays) return 'No live bay coverage'
  if (!totalBays) return 'No live bay coverage'
  if (totalBays < 4) return 'Limited live data'
  return 'Live bays'
}

function buildReasons(detail) {
  const reasons = []
  if (detail.occ_pct >= 80) reasons.push('Most bays taken')
  else if (detail.occ_pct >= 50) reasons.push('Bays filling up')
  if (detail.trend === 'up') reasons.push('Traffic rising')
  if (detail.events_nearby?.length > 0) reasons.push('Event nearby')
  if (reasons.length === 0 && detail.level === 'low') reasons.push('Bays look available')
  return reasons
}

export default function SegmentPopup({
  detail,
  colorBlindMode = false,
  onRequestClose,
  onMarkAsTarget,
  isMobile = false,
}) {
  const rootRef = useRef(null)

  useLayoutEffect(() => {
    rootRef.current?.focus?.()
  }, [detail])

  const onKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onRequestClose?.()
      }
    },
    [onRequestClose],
  )

  if (!detail) return null
  const tone = levelToTone(detail.level)
  const dot = getStatusFillColor(tone, colorBlindMode)
  const pct = detail.pressure != null ? Math.round(detail.pressure * 100) : null
  const trendStr = TREND_LABEL[detail.trend] || ''
  const trendAria = TREND_ARIA[detail.trend] || 'steady'
  const reasons = buildReasons(detail)
  const coverage = coverageText(detail.total_bays, detail.has_live_bays)

  return (
    <div
      ref={rootRef}
      tabIndex={0}
      role="dialog"
      aria-modal="false"
      aria-label="Street parking chance detail"
      className="min-w-[200px] max-w-[260px] text-[12px] outline-none"
      onKeyDown={onKeyDown}
    >
      <div className="mb-1 flex items-center gap-1.5">
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: dot }}
          aria-hidden
        />
        <span className="truncate font-semibold text-gray-900 dark:text-gray-100">
          {detail.street_name || 'Street segment'}
        </span>
      </div>
      {detail.seg_descr && (
        <div className="mb-1 text-[10px] text-gray-500 dark:text-gray-400">
          {detail.seg_descr}
        </div>
      )}
      <div className="text-[11px] font-medium text-gray-700 dark:text-gray-200">
        {CHANCE_TEXT[detail.level] || 'No live estimate'}
        {detail.occ_pct != null && ` · ${detail.occ_pct}% taken`}
        {trendStr && (
          <span className="whitespace-nowrap" aria-label={trendAria}>
            {` ${trendStr}`}
          </span>
        )}
      </div>
      {detail.total_bays > 0 && detail.has_live_bays && (
        <div className="mt-0.5 text-[11px] text-gray-600 dark:text-gray-300">
          {detail.free_bays} of {detail.total_bays} bays free
        </div>
      )}
      <div className="mt-0.5 text-[10px] text-gray-500 dark:text-gray-400">
        {coverage}
        {pct != null && ` · ${pct}% pressure signal`}
      </div>
      {reasons.length > 0 && (
        <div className="mt-1 text-[10px] text-gray-600 dark:text-gray-300">
          Why: {reasons.join(' · ')}
        </div>
      )}
      <EventBadge events={detail.events_nearby} />
      {onMarkAsTarget && (
        <button
          type="button"
          onClick={onMarkAsTarget}
          className={`mt-2 w-full rounded-lg border border-emerald-300 bg-emerald-50 px-2 font-semibold text-emerald-800 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-100 ${
            isMobile ? 'min-h-[44px] py-2 text-[12px]' : 'py-1 text-[11px]'
          }`}
        >
          {isMobile ? 'Use this street' : 'Mark as less busy pick'}
        </button>
      )}
    </div>
  )
}
