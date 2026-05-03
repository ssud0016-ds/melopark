import { useMemo, useState } from 'react'

/**
 * Parking Sign Translator (redesigned).
 *
 * Layered, glanceable presentation of `evaluation.translator_rules`:
 *   1. NOW chip — the rule active right now (or "Free now" if outside hours).
 *      Auto-expanded so the user reads the controlling rule without tapping.
 *   2. NEXT chip — the upcoming strict rule that begins during the stay.
 *      Compact; tap to reveal body.
 *   3. "Show full schedule" disclosure — every other rule, collapsed by default,
 *      one tap per row to reveal the full plain-English body.
 *
 * Rule text is never invented — emojis, condensed day/time, and category labels
 * are derived from `heading` + `body` returned by the backend.
 */

// Order matters: tow-away/clearway must be checked before generic "no" patterns.
const SIGNAL_PATTERNS = [
  { test: /(tow[\s-]?away|clearway|no\s+stopping)/i, emoji: '🚫', label: 'No stopping' },
  { test: /loading\s*zone|\bloading\b/i, emoji: '📦', label: 'Loading zone' },
  { test: /(disabled|disability\s+permit|permit\s+only)/i, emoji: '♿', label: 'Permit only' },
  { test: /(no\s+payment|no\s+limit\s+and\s+no\s+payment|\bfree\b)/i, emoji: '🌙', label: 'Free' },
  { test: /(meter|\bpay\b|paid\b)/i, emoji: '💵', label: 'Pay meter' },
]

function detectSignal(body) {
  for (const p of SIGNAL_PATTERNS) {
    if (p.test.test(body || '')) return { emoji: p.emoji, label: p.label }
  }
  return { emoji: '🅿️', label: 'Parking' }
}

function detectStayLimit(body) {
  const h = (body || '').match(/up to (\d+)\s*hour/i)
  if (h) return `${h[1]}P`
  const m = (body || '').match(/up to (\d+)\s*min/i)
  if (m) return `${m[1]}m`
  return null
}

function sanitizeRuleBody(body) {
  const raw = (body || '').trim()
  if (!raw) return raw

  // Remove generic infringement/fine statements from per-rule copy to keep
  // schedule rows focused on actionable timing/category details.
  const sentences = raw.split(/(?<=[.!?])\s+/)
  const kept = sentences.filter(
    (s) =>
      !/(?:\bfines?\b|\bpenalt(?:y|ies)\b|\binfringements?\b|\bfined\b|\bpenalized\b)/i.test(s),
  )

  const stripped = kept
    .join(' ')
    .replace(
      /\s*[,;:-]?\s*(?:fines?|penalt(?:y|ies)|infringements?)\s+(?:may\s+)?apply\.?/gi,
      '',
    )
    .replace(/\s{2,}/g, ' ')
    .trim()

  return stripped || raw
}

const DAY_SHORT = {
  Sunday: 'Sun',
  Monday: 'Mon',
  Tuesday: 'Tue',
  Wednesday: 'Wed',
  Thursday: 'Thu',
  Friday: 'Fri',
  Saturday: 'Sat',
}

function condenseTime(s) {
  if (!s) return s
  return s.replace(/(\d{1,2}):00\s+(AM|PM)/, '$1 $2').trim()
}

function condenseHeading(heading) {
  if (!heading) return null
  if (/^outside/i.test(heading)) return { isOutside: true }
  const range = heading.match(/^(\w+) to (\w+) from (.+?) to (.+)$/)
  if (range) {
    return {
      days: `${DAY_SHORT[range[1]] || range[1]}–${DAY_SHORT[range[2]] || range[2]}`,
      window: `${condenseTime(range[3])}–${condenseTime(range[4])}`,
    }
  }
  const single = heading.match(/^(\w+) from (.+?) to (.+)$/)
  if (single) {
    return {
      days: DAY_SHORT[single[1]] || single[1],
      window: `${condenseTime(single[2])}–${condenseTime(single[3])}`,
    }
  }
  return { days: heading, window: '' }
}

function ruleKey(r) {
  return `${r.heading}::${r.body}`
}

function isStrictRule(rule) {
  const text = `${rule?.heading || ''} ${rule?.body || ''}`
  return /(tow[\s-]?away|clearway|no\s+stopping|loading\s*zone|permit\s+only|disabled)/i.test(text)
}

const TONE_CLASS = {
  'now-active':
    'border-emerald-400 bg-emerald-50 hover:bg-emerald-100 dark:border-emerald-600 dark:bg-emerald-900/20',
  'now-free':
    'border-indigo-400 bg-indigo-50 hover:bg-indigo-100 dark:border-indigo-600 dark:bg-indigo-900/20',
  next:
    'border-amber-400 bg-amber-50 hover:bg-amber-100 dark:border-amber-600 dark:bg-amber-900/20',
  normal:
    'border-gray-200 bg-white hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800/40 dark:hover:bg-gray-800/60',
}

const BADGE_CLASS = {
  'now-active': 'bg-emerald-600 text-white',
  'now-free': 'bg-indigo-600 text-white',
  next: 'bg-amber-600 text-white',
}

const BADGE_LABEL = {
  'now-active': 'In effect',
  'now-free': 'Free now',
  next: 'Up next',
}

function RuleChip({ rule, tone, isOpen, onToggle }) {
  const cleanBody = sanitizeRuleBody(rule.body)
  const sig = detectSignal(cleanBody)
  const stayLimit = detectStayLimit(cleanBody)
  const cond = condenseHeading(rule.heading)
  const isOutside = cond?.isOutside

  const toneClass = TONE_CLASS[tone] || TONE_CLASS.normal
  const badgeLabel = BADGE_LABEL[tone] || null
  const badgeClass = BADGE_CLASS[tone] || ''

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={isOpen}
      title={`${rule.heading} — ${cleanBody}`}
      className={`w-full rounded-xl border px-3 py-2 text-left transition-colors ${toneClass}`}
    >
      <div className="flex items-center gap-2">
        {badgeLabel && (
          <span
            className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${badgeClass}`}
          >
            {badgeLabel}
          </span>
        )}
        <span className="shrink-0 text-base leading-none" aria-hidden>
          {sig.emoji}
        </span>
        <span className="min-w-0 flex-1 truncate text-xs font-semibold text-gray-900 dark:text-gray-100">
          {isOutside ? (
            <>No restrictions <span className="opacity-70">· free, no payment</span></>
          ) : (
            <>
              {cond?.days}
              {cond?.window && <span className="opacity-70"> · {cond.window}</span>}
              {stayLimit && <span className="opacity-90"> · {stayLimit}</span>}
              {sig.label !== 'Parking' && <span className="opacity-70"> · {sig.label}</span>}
            </>
          )}
        </span>
        <span
          className="shrink-0 text-[10px] text-gray-500 dark:text-gray-400"
          aria-hidden
        >
          {isOpen ? '▴' : '▾'}
        </span>
      </div>

      {isOpen && (
        <div className="mt-2 border-t border-current/10 pt-2 text-[11px] font-normal leading-relaxed text-gray-700 dark:text-gray-200">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider opacity-60">
            {rule.heading}
          </div>
          <div>{cleanBody}</div>
        </div>
      )}
    </button>
  )
}

export default function ParkingSignTranslator({ evaluation }) {
  const rules = Array.isArray(evaluation?.translator_rules) ? evaluation.translator_rules : []

  const current = rules.find((r) => r.state === 'current') || null
  const upcoming = rules.find((r) => r.state === 'upcoming') || null
  const outside = rules.find((r) => r.state === 'outside') || null

  // "Other rules" = everything not pinned as the NOW or NEXT chip, deduplicated.
  const others = useMemo(() => {
    const exclude = new Set()
    if (current) exclude.add(ruleKey(current))
    if (upcoming) exclude.add(ruleKey(upcoming))
    // When no current rule, the outside card is shown as the NOW chip.
    if (!current && outside) exclude.add(ruleKey(outside))

    const seen = new Set()
    const out = []
    for (const r of rules) {
      const k = ruleKey(r)
      if (exclude.has(k)) continue
      if (seen.has(k)) continue
      seen.add(k)
      out.push(r)
    }
    return out
  }, [rules, current, upcoming, outside])

  // NOW chip auto-expanded by default so the controlling rule is visible
  // without a tap; the user can collapse it. Other chips track open state
  // independently.
  const [nowCollapsed, setNowCollapsed] = useState(false)
  const [openExtra, setOpenExtra] = useState(() => new Set())
  const [showAll, setShowAll] = useState(false)

  const toggleExtra = (key) => {
    setOpenExtra((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const isEmpty = rules.length === 0
  const showRiskNote = Boolean((current && isStrictRule(current)) || (upcoming && isStrictRule(upcoming)))

  return (
    <div className="px-5 mt-6 pb-6">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <div className="text-sm font-semibold text-gray-700 dark:text-gray-200">
          Parking Sign Translator
        </div>
        {!isEmpty && (
          <div className="text-[10px] text-gray-500 dark:text-gray-400">
            Tap a row for full rule
          </div>
        )}
      </div>

      {isEmpty ? (
        <div className="rounded-xl border border-gray-200 bg-white/70 px-4 py-3 text-xs text-gray-600 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-300">
          No rule breakdown available. Check posted signage.
        </div>
      ) : (
        <>
          {current ? (
            <RuleChip
              rule={current}
              tone="now-active"
              isOpen={!nowCollapsed}
              onToggle={() => setNowCollapsed((c) => !c)}
            />
          ) : outside ? (
            <RuleChip
              rule={outside}
              tone="now-free"
              isOpen={!nowCollapsed}
              onToggle={() => setNowCollapsed((c) => !c)}
            />
          ) : null}

          {upcoming && (
            <div className="mt-2">
              <RuleChip
                rule={upcoming}
                tone="next"
                isOpen={openExtra.has('upcoming')}
                onToggle={() => toggleExtra('upcoming')}
              />
            </div>
          )}

          {showRiskNote && (
            <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-900 dark:border-amber-700/50 dark:bg-amber-900/20 dark:text-amber-100">
              <span className="font-semibold">Infringement risk:</span> amounts vary by rule type and official updates. Check posted signage for enforcement details.
            </div>
          )}

          {others.length > 0 && (
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setShowAll((s) => !s)}
                aria-expanded={showAll}
                className="text-[11px] font-semibold text-brand hover:underline dark:text-brand-light"
              >
                {showAll ? 'Hide full schedule' : `Show full schedule (${others.length})`}
              </button>
              {showAll && (
                <div className="mt-2 space-y-1.5">
                  {others.map((r, i) => {
                    const k = `o-${i}`
                    return (
                      <RuleChip
                        key={k}
                        rule={r}
                        tone="normal"
                        isOpen={openExtra.has(k)}
                        onToggle={() => toggleExtra(k)}
                      />
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
