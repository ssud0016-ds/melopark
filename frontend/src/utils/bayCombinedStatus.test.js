import { describe, expect, it } from 'vitest'
import { combinedStatus, combinedFillColor } from './bayCombinedStatus'

const cases = [
  { sensor: 1,         verdict: 'yes',     state: 'available',         heroWord: 'YES',   color: 'green' },
  { sensor: 1,         verdict: 'no',      state: 'illegal',           heroWord: 'NO',    color: 'red' },
  { sensor: 1,         verdict: 'unknown', state: 'free_unknown',      heroWord: 'CHECK', color: 'amber' },
  { sensor: 0,         verdict: 'yes',     state: 'taken_legal',       heroWord: 'YES',   color: 'amber' },
  { sensor: 0,         verdict: 'no',      state: 'taken_illegal',     heroWord: 'NO',    color: 'red' },
  { sensor: 0,         verdict: 'unknown', state: 'taken_unknown',     heroWord: 'CHECK', color: 'grey' },
  { sensor: undefined, verdict: 'yes',     state: 'legal_no_sensor',   heroWord: 'YES',   color: 'blue' },
  { sensor: undefined, verdict: 'no',      state: 'illegal_no_sensor', heroWord: 'NO',    color: 'red' },
  { sensor: undefined, verdict: 'unknown', state: 'none',              heroWord: 'CHECK', color: 'grey' },
]

describe('combinedStatus matrix', () => {
  it.each(cases)(
    'sensor=$sensor verdict=$verdict -> $state ($heroWord, $color)',
    ({ sensor, verdict, state, heroWord, color }) => {
      const r = combinedStatus({ free: sensor }, verdict ? { verdict } : null)
      expect(r.state).toBe(state)
      expect(r.heroWord).toBe(heroWord)
      expect(r.color).toBe(color)
      expect(typeof r.heroSentence).toBe('string')
      expect(r.heroSentence.length).toBeGreaterThan(0)
    },
  )

  it('falls back to none when bay and evaluation are empty', () => {
    const r = combinedStatus(null, null)
    expect(r.state).toBe('none')
    expect(r.heroWord).toBe('CHECK')
  })
})

describe('combinedFillColor', () => {
  it('returns hex per state', () => {
    expect(combinedFillColor('available')).toBe('#a3ec48')
    expect(combinedFillColor('taken_legal')).toBe('#f59e0b')
    expect(combinedFillColor('illegal_no_sensor')).toBe('#ed6868')
    expect(combinedFillColor('legal_no_sensor')).toBe('#60a5fa')
    expect(combinedFillColor('none')).toBe('#9ca3af')
  })
})
