/**
 * Build segment Busy Now popup content as DOM (textContent only — safe for untrusted MVT props).
 */
const CHANCE_TEXT = { low: 'Good parking chance', medium: 'Getting busy', high: 'Hard to park', unknown: 'No live estimate' }

export function buildSegmentPopupDom(props) {
  const root = document.createElement('div')
  root.style.font = '600 12px Inter,system-ui'

  const title = document.createElement('strong')
  title.textContent = String(props?.name || 'Segment')
  root.appendChild(title)

  const lvl = document.createElement('div')
  const level = String(props?.level ?? '')
  const pRaw = Number(props?.p)
  const pressurePct = Number.isFinite(pRaw) ? Math.round(pRaw * 100) : null
  const chance = CHANCE_TEXT[level] || 'No live estimate'
  lvl.textContent = pressurePct != null ? `${chance} · ${pressurePct}% signal` : chance
  root.appendChild(lvl)

  const total = Number(props?.total) || 0
  const hasLiveBays = props?.has_live_bays !== false
  if (total > 0 && hasLiveBays) {
    const free = Number(props?.free) || 0
    const bays = document.createElement('div')
    bays.textContent = `${free} of ${total} bays free`
    root.appendChild(bays)
  }

  if (total > 0) {
    const coverage = document.createElement('div')
    coverage.textContent = !hasLiveBays ? 'No live bay coverage' : total < 4 ? 'Limited live data' : 'Live bays'
    root.appendChild(coverage)
  }

  const evt = Number(props?.evt) || 0
  if (evt > 0) {
    const evts = document.createElement('div')
    evts.textContent = `${evt} event(s) nearby`
    root.appendChild(evts)
  }

  return root
}
