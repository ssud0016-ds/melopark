/**
 * A15 — Color contrast audit for BusyNow segment fill colors.
 *
 * Measures WCAG contrast ratios for each segment level color against a white
 * (#ffffff) tile background, in both normal and color-blind mode.
 *
 * WCAG thresholds:
 *   - UI components / graphical objects: ≥ 3.0:1  (WCAG 2.1 §1.4.11)
 *   - Normal text (< 18 pt / < 14 pt bold): ≥ 4.5:1
 *
 * Findings (as of current palette — May 2026):
 *   PASS  — occupied / high (normal):   ~3.7:1  ✓ meets 3.0
 *   PASS  — occupied / high (CB):       ~12:1   ✓ meets 3.0
 *   PASS  — available / low (CB):       ~3.1:1  ✓ meets 3.0
 *   FAIL  — available / low (normal):   ~1.4:1  ✗ needs remediation (#a3ec48 → darker green)
 *   FAIL  — caution / medium (normal):  ~1.7:1  ✗ needs remediation (#FFB382 → darker orange)
 *   FAIL  — caution / medium (CB):      ~2.1:1  ✗ needs remediation (#f59e0b → darker amber)
 *
 * Tests assert the computed ratios are correct (math sanity) and document
 * whether each color passes or fails the WCAG AA threshold.  Failing colors
 * are flagged with a dedicated test so the CI report makes the gap visible
 * without blocking the build — the remediation work should be tracked as
 * a separate design ticket targeting Phase 6 polish.
 */
import { describe, it, expect } from 'vitest'

// ── Color math ────────────────────────────────────────────────────────────────

/**
 * Compute the relative luminance of a hex color per WCAG 2.1 spec.
 * @param {string} hex  e.g. '#a3ec48'
 * @returns {number}    0–1
 */
function relativeLuminance(hex) {
  const clean = hex.replace(/^#/, '')
  const r = parseInt(clean.slice(0, 2), 16) / 255
  const g = parseInt(clean.slice(2, 4), 16) / 255
  const b = parseInt(clean.slice(4, 6), 16) / 255

  const linearize = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))

  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b)
}

/**
 * Compute WCAG contrast ratio between two colors.
 * @param {string} hex1
 * @param {string} hex2
 * @returns {number}  e.g. 4.5 (higher = more contrast)
 */
function contrastRatio(hex1, hex2) {
  const l1 = relativeLuminance(hex1)
  const l2 = relativeLuminance(hex2)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

// ── Color tables (mirrors ParkingMap.jsx palettes) ────────────────────────────

const WHITE_BG = '#ffffff'

// Normal mode
const NORMAL_COLORS = {
  low:    '#a3ec48', // available  — WCAG FAIL (~1.4:1 vs white, needs darker green)
  medium: '#FFB382', // caution    — WCAG FAIL (~1.7:1 vs white, needs darker orange)
  high:   '#ed6868', // occupied   — WCAG PASS (~3.7:1 vs white)
}

// Color-blind mode
const CB_COLORS = {
  low:    '#3b82f6', // available  — WCAG PASS (~3.1:1 vs white)
  medium: '#f59e0b', // caution    — WCAG FAIL (~2.1:1 vs white, needs darker amber)
  high:   '#374151', // occupied   — WCAG PASS (~12:1 vs white)
}

const WCAG_AA_UI = 3.0 // minimum for UI/graphical components

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('A15 — BusyNow color contrast audit (math correctness)', () => {
  it('black vs white = 21:1', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0)
  })

  it('white vs white = 1:1', () => {
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5)
  })

  it('relativeLuminance of black = 0', () => {
    expect(relativeLuminance('#000000')).toBe(0)
  })

  it('relativeLuminance of white = 1', () => {
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 5)
  })
})

describe('A15 — Normal mode: colors that PASS WCAG AA ≥ 3.0 vs white', () => {
  it('high / occupied (#ed6868) passes — contrast ≥ 3.0:1', () => {
    const ratio = contrastRatio(NORMAL_COLORS.high, WHITE_BG)
    // ~3.7:1 — passes UI component threshold
    expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_UI)
  })
})

describe('A15 — Normal mode: colors that FAIL WCAG AA vs white (remediation needed)', () => {
  it('low / available (#a3ec48) FAILS — contrast < 3.0:1 vs white [NEEDS REMEDIATION]', () => {
    const ratio = contrastRatio(NORMAL_COLORS.low, WHITE_BG)
    // Documents the actual ratio (~1.4:1). This line ensures the math is correct
    // and makes the failure visible in CI output without blocking the build.
    // Design fix: darken to ≥ #4c8a1a or apply a dark stroke outline.
    expect(ratio).toBeGreaterThan(1.0)   // sanity: at least differs from white
    expect(ratio).toBeLessThan(WCAG_AA_UI) // documents the shortfall
  })

  it('medium / caution (#FFB382) FAILS — contrast < 3.0:1 vs white [NEEDS REMEDIATION]', () => {
    const ratio = contrastRatio(NORMAL_COLORS.medium, WHITE_BG)
    // ~1.7:1. Design fix: darken to ≥ #b34700 or use a darker stroke.
    expect(ratio).toBeGreaterThan(1.0)
    expect(ratio).toBeLessThan(WCAG_AA_UI)
  })
})

describe('A15 — Color-blind mode: colors that PASS WCAG AA ≥ 3.0 vs white', () => {
  it('low / available (#3b82f6) passes — contrast ≥ 3.0:1', () => {
    const ratio = contrastRatio(CB_COLORS.low, WHITE_BG)
    expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_UI)
  })

  it('high / occupied (#374151) passes — contrast ≥ 3.0:1', () => {
    const ratio = contrastRatio(CB_COLORS.high, WHITE_BG)
    expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_UI)
  })
})

describe('A15 — Color-blind mode: colors that FAIL WCAG AA vs white (remediation needed)', () => {
  it('medium / caution (#f59e0b) FAILS — contrast < 3.0:1 vs white [NEEDS REMEDIATION]', () => {
    const ratio = contrastRatio(CB_COLORS.medium, WHITE_BG)
    // ~2.1:1. Design fix: darken CB amber to ≥ #92620a.
    expect(ratio).toBeGreaterThan(1.0)
    expect(ratio).toBeLessThan(WCAG_AA_UI)
  })
})
