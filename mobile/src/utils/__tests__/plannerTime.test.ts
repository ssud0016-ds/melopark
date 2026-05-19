import {
  DEFAULT_PLANNER_DURATION_MINS,
  durationFilterLabel,
  formatMelbourneDate,
  formatMelbourneTime,
  isFuturePlanningArrival,
  melbourneAwareIsoFromDateTimeLocal,
  melbourneWallClockToAwareIso,
  toMelbourneDateTimeInputValue,
} from '../plannerTime';

function isNaivePlannerIso(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(s);
}

const SUMMER_WALL = { y: 2026, mo: 1, d: 15, hh: 9, mm: 30 };
const WINTER_WALL = { y: 2026, mo: 7, d: 15, hh: 14, mm: 30 };

describe('plannerTime Melbourne arrival_iso', () => {
  it('DEFAULT_PLANNER_DURATION_MINS is 60', () => {
    expect(DEFAULT_PLANNER_DURATION_MINS).toBe(60);
  });

  it('summer wall-clock uses +11:00 (AEDT)', () => {
    const { y, mo, d, hh, mm } = SUMMER_WALL;
    const iso = melbourneWallClockToAwareIso(y, mo, d, hh, mm, 0);
    expect(iso).toMatch(/\+11:00$/);
    expect(isNaivePlannerIso(iso)).toBe(false);
  });

  it('winter wall-clock uses +10:00 (AEST)', () => {
    const { y, mo, d, hh, mm } = WINTER_WALL;
    const iso = melbourneWallClockToAwareIso(y, mo, d, hh, mm, 0);
    expect(iso).toMatch(/\+10:00$/);
    expect(isNaivePlannerIso(iso)).toBe(false);
  });

  it('formatMelbourneDate uses dd/mm/yyyy', () => {
    const iso = melbourneWallClockToAwareIso(2026, 5, 18, 13, 7, 0);
    expect(formatMelbourneDate(iso)).toMatch(/^Mon, 18\/05\/2026$/);
  });

  it('formatMelbourneTime uppercases AM/PM', () => {
    const iso = melbourneWallClockToAwareIso(2026, 5, 18, 13, 7, 0);
    expect(formatMelbourneTime(iso)).toMatch(/1:07\s*PM/i);
  });

  it('durationFilterLabel maps 1h chip to 1H', () => {
    expect(durationFilterLabel('1h')).toBe('1H');
    expect(durationFilterLabel(null)).toBe('Any duration');
  });

  it('melbourneAwareIsoFromDateTimeLocal keeps wall clock prefix', () => {
    const iso = melbourneAwareIsoFromDateTimeLocal('2026-03-08T16:45');
    expect(iso).toBeTruthy();
    expect(iso!.startsWith('2026-03-08T16:45:00')).toBe(true);
    expect(iso).toMatch(/[+-]\d{2}:\d{2}$/);
  });

  it('round-trip aware ISO through datetime input value', () => {
    const aware = melbourneWallClockToAwareIso(2026, 1, 20, 14, 45, 0);
    const input = toMelbourneDateTimeInputValue(aware);
    expect(input).toBe('2026-01-20T14:45');
    expect(melbourneAwareIsoFromDateTimeLocal(input)).toBe(aware);
  });

  it('isFuturePlanningArrival is true for +2h', () => {
    const future = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    expect(isFuturePlanningArrival(future)).toBe(true);
  });

  it('isFuturePlanningArrival is false for live now', () => {
    expect(isFuturePlanningArrival(new Date().toISOString())).toBe(false);
    expect(isFuturePlanningArrival(null)).toBe(false);
  });
});
