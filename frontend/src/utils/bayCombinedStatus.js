/**
 * Combined bay status from occupancy (sensor) + rules verdict (evaluate API).
 *
 * Single source of truth for the 9-cell matrix defined in
 * docs/plans/occupancy_vs_verdict_split.md.
 *
 * No backend schema change needed: derived client-side.
 */

/**
 * @typedef {Object} CombinedStatus
 * @property {string} state        - Machine key (e.g. 'available', 'taken_legal')
 * @property {string} headline     - Top-line user copy (legacy banner copy)
 * @property {string} sub          - Secondary detail line (legacy banner copy)
 * @property {string} heroWord     - 'YES' | 'NO' | 'CHECK' for hero verdict
 * @property {string} heroSentence - One-line nuance under the hero word
 * @property {string} color        - 'green' | 'red' | 'amber' | 'blue' | 'grey'
 * @property {string} icon         - Emoji for quick scan
 */

const MATRIX = {
  // sensor free + rules yes
  'free|yes': {
    state: 'available',
    headline: 'Park here now',
    sub: 'Space is free, rules allow parking',
    heroWord: 'YES',
    heroSentence: 'Park here now',
    color: 'green',
    icon: '\u2705',
  },
  // sensor free + rules no
  'free|no': {
    state: 'illegal',
    headline: 'Free spot, rules block parking',
    sub: 'Space is free but parking is not allowed right now',
    heroWord: 'NO',
    heroSentence: 'Rules block parking now',
    color: 'red',
    icon: '\uD83D\uDEAB',
  },
  // sensor free + rules unknown
  'free|unknown': {
    state: 'free_unknown',
    headline: 'Free now, rules unclear',
    sub: 'Check signs before parking',
    heroWord: 'CHECK',
    heroSentence: 'Free, but rules unclear',
    color: 'amber',
    icon: '\u26A0\uFE0F',
  },
  // sensor occupied + rules yes
  'occupied|yes': {
    state: 'taken_legal',
    headline: 'Currently taken',
    sub: 'Rules allow parking here',
    heroWord: 'YES',
    heroSentence: 'Rules allow, but bay is taken',
    color: 'amber',
    icon: '\u23F3',
  },
  // sensor occupied + rules no
  'occupied|no': {
    state: 'taken_illegal',
    headline: 'Currently taken',
    sub: 'Rules also block parking here',
    heroWord: 'NO',
    heroSentence: 'Bay taken and rules block',
    color: 'red',
    icon: '\uD83D\uDEAB',
  },
  // sensor occupied + rules unknown
  'occupied|unknown': {
    state: 'taken_unknown',
    headline: 'Currently taken',
    sub: 'Rules unclear, check signs',
    heroWord: 'CHECK',
    heroSentence: 'Taken, rules unclear',
    color: 'grey',
    icon: '\u2753',
  },
  // sensor unknown + rules yes
  'unknown|yes': {
    state: 'legal_no_sensor',
    headline: 'Rules allow parking',
    sub: 'No live occupancy data',
    heroWord: 'YES',
    heroSentence: 'Rules allow. No live sensor',
    color: 'blue',
    icon: '\u2139\uFE0F',
  },
  // sensor unknown + rules no
  'unknown|no': {
    state: 'illegal_no_sensor',
    headline: 'Rules block parking',
    sub: 'No live occupancy data',
    heroWord: 'NO',
    heroSentence: 'Rules block parking',
    color: 'red',
    icon: '\uD83D\uDEAB',
  },
  // sensor unknown + rules unknown
  'unknown|unknown': {
    state: 'none',
    headline: 'No data',
    sub: 'Check signage on site',
    heroWord: 'CHECK',
    heroSentence: 'No data. Read the sign',
    color: 'grey',
    icon: '\u2753',
  },
}

/** CSS color tokens for each combined color key. */
export const COMBINED_COLORS = {
  green: {
    bg: 'bg-emerald-600',
    bgLight: 'bg-emerald-50 dark:bg-emerald-900/20',
    text: 'text-white',
    textMuted: 'text-emerald-100',
    border: 'border-emerald-700',
    dot: '#a3ec48',
    fill: '#a3ec48',
  },
  red: {
    bg: 'bg-red-600',
    bgLight: 'bg-red-50 dark:bg-red-900/20',
    text: 'text-white',
    textMuted: 'text-red-100',
    border: 'border-red-700',
    dot: '#ef4444',
    fill: '#ed6868',
  },
  amber: {
    bg: 'bg-amber-500',
    bgLight: 'bg-amber-50 dark:bg-amber-900/20',
    text: 'text-white',
    textMuted: 'text-amber-100',
    border: 'border-amber-600',
    dot: '#f59e0b',
    fill: '#f59e0b',
  },
  blue: {
    bg: 'bg-blue-600',
    bgLight: 'bg-blue-50 dark:bg-blue-900/20',
    text: 'text-white',
    textMuted: 'text-blue-100',
    border: 'border-blue-700',
    dot: '#3b82f6',
    fill: '#60a5fa',
  },
  grey: {
    bg: 'bg-gray-500',
    bgLight: 'bg-gray-50 dark:bg-gray-800/50',
    text: 'text-white',
    textMuted: 'text-gray-200',
    border: 'border-gray-600',
    dot: '#9ca3af',
    fill: '#9ca3af',
  },
}

/**
 * Derive the combined status from a bay object and its evaluation.
 *
 * @param {{ free?: number }} bay - Bay from /api/parking (bay.free: 0|1|undefined)
 * @param {{ verdict?: string } | null} evaluation - From /api/bays/{id}/evaluate
 * @returns {CombinedStatus}
 */
export function combinedStatus(bay, evaluation) {
  const sensor =
    bay?.free === 1 ? 'free' : bay?.free === 0 ? 'occupied' : 'unknown'
  const verdict = evaluation?.verdict ?? 'unknown'
  const key = `${sensor}|${verdict}`
  return MATRIX[key] || MATRIX['unknown|unknown']
}

/**
 * Map fill color for a bay given its combined state.
 * Used by ParkingMap dot rendering.
 *
 * @param {string} state - Combined state key from combinedStatus()
 * @returns {string} Hex color
 */
export function combinedFillColor(state) {
  switch (state) {
    case 'available':
      return COMBINED_COLORS.green.fill
    case 'illegal':
    case 'taken_illegal':
    case 'illegal_no_sensor':
      return COMBINED_COLORS.red.fill
    case 'taken_legal':
    case 'free_unknown':
      return COMBINED_COLORS.amber.fill
    case 'legal_no_sensor':
      return COMBINED_COLORS.blue.fill
    default:
      return COMBINED_COLORS.grey.fill
  }
}
