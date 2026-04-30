/**
 * Bug 3 — arrival_iso must be timezone-aware with Australia/Melbourne offset
 * (no naive planner strings sent to the API).
 */

import { describe, expect, it } from 'vitest'

import {
  DEFAULT_PLANNER_DURATION_MINS,
  PLANNER_DURATION_PRESETS_MINS,
  formatDurationLabel,
  melbourneAwareIsoFromDateTimeLocal,
  melbourneWallClockToAwareIso,
  nextQuarterHourDefaults,
  toMelbourneDateTimeInputValue,
} from './plannerTime'

/** True when string looks like naive ISO local datetime (no zone suffix). */
function isNaivePlannerIso(s) {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(s)
}

/** Melbourne summer (AEDT): fixed wall-clock date in southern-hemisphere “summer”. */
const SUMMER_WALL = { y: 2026, mo: 1, d: 15, hh: 9, mm: 30 }

/** Melbourne winter (AEST): mid-year standard time. */
const WINTER_WALL = { y: 2026, mo: 7, d: 15, hh: 14, mm: 30 }

describe('Bug 3 — plannerTime Melbourne arrival_iso', () => {
  describe('planner duration defaults and presets', () => {
    it('uses DEFAULT_PLANNER_DURATION_MINS (60) in nextQuarterHourDefaults', () => {
      expect(DEFAULT_PLANNER_DURATION_MINS).toBe(60)
      const { durationMins } = nextQuarterHourDefaults()
      expect(durationMins).toBe(DEFAULT_PLANNER_DURATION_MINS)
    })

    it('formatDurationLabel matches preset list labels', () => {
      const expected = [
        [30, '30 min'],
        [60, '1 hr'],
        [90, '1.5 hr'],
        [120, '2 hr'],
        [180, '3 hr'],
        [240, '4 hr'],
      ]
      expect(PLANNER_DURATION_PRESETS_MINS).toEqual([30, 60, 90, 120, 180, 240])
      for (const [mins, label] of expected) {
        expect(formatDurationLabel(mins)).toBe(label)
      }
    })

    it('formatDurationLabel keeps non-preset behaviour (hours and minutes)', () => {
      expect(formatDurationLabel(45)).toBe('45 min')
      expect(formatDurationLabel(300)).toBe('5 hr')
      expect(formatDurationLabel(75)).toBe('75 min')
      expect(formatDurationLabel(Number.NaN)).toBe('')
    })
  })

  describe('nextQuarterHourDefaults', () => {
    it('returns iso with explicit numeric timezone offset (+/-HH:MM)', () => {
      const { iso } = nextQuarterHourDefaults()
      expect(iso).toMatch(/[+-]\d{2}:\d{2}$/)
    })

    it('does not return a naive datetime string', () => {
      const { iso } = nextQuarterHourDefaults()
      expect(isNaivePlannerIso(iso)).toBe(false)
      expect(iso.endsWith('Z')).toBe(false)
    })
  })

  describe('Australia/Melbourne offset (+10 / +11)', () => {
    it('summer wall-clock date uses +11:00 (AEDT)', () => {
      const { y, mo, d, hh, mm } = SUMMER_WALL
      const iso = melbourneWallClockToAwareIso(y, mo, d, hh, mm, 0)
      expect(iso).toMatch(/\+11:00$/)
      expect(isNaivePlannerIso(iso)).toBe(false)
    })

    it('winter wall-clock date uses +10:00 (AEST)', () => {
      const { y, mo, d, hh, mm } = WINTER_WALL
      const iso = melbourneWallClockToAwareIso(y, mo, d, hh, mm, 0)
      expect(iso).toMatch(/\+10:00$/)
      expect(isNaivePlannerIso(iso)).toBe(false)
    })
  })

  describe('generated planner ISO is never naive', () => {
    it('melbourneWallClockToAwareIso always appends offset', () => {
      const iso = melbourneWallClockToAwareIso(2026, 12, 22, 14, 0, 0)
      expect(iso).toMatch(/^2026-12-22T14:00:00[+-]\d{2}:\d{2}$/)
      expect(isNaivePlannerIso(iso)).toBe(false)
    })
  })

  describe('datetime-local style string → Melbourne wall clock preserved', () => {
    it('melbourneAwareIsoFromDateTimeLocal keeps Y-M-D and H:M in the literal prefix', () => {
      const raw = '2026-03-08T16:45'
      const iso = melbourneAwareIsoFromDateTimeLocal(raw)
      expect(iso).toBeTruthy()
      expect(iso.startsWith('2026-03-08T16:45:00')).toBe(true)
      expect(iso).toMatch(/[+-]\d{2}:\d{2}$/)
    })

    it('round-trip: aware ISO → toMelbourneDateTimeInputValue → back to same aware ISO', () => {
      const aware = melbourneWallClockToAwareIso(2026, 1, 20, 14, 45, 0)
      const input = toMelbourneDateTimeInputValue(aware)
      expect(input).toBe('2026-01-20T14:45')
      expect(melbourneAwareIsoFromDateTimeLocal(input)).toBe(aware)
    })
  })
})
