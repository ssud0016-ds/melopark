import { describe, expect, it } from 'vitest'

import { buildSegmentPopupDom } from './segmentPopupDom'

describe('B12 — segment popup DOM (XSS hardening)', () => {
  it('renders malicious street_name as text nodes only, no executable HTML', () => {
    const payload = '<img src=x onerror="window.__pwned=true">'
    const root = buildSegmentPopupDom({ name: payload, level: 'high', p: 0.5 })
    expect(root.querySelector('img')).toBeNull()
    expect(root.textContent).toContain(payload)
  })

  it('coerces numeric fields so string totals do not inject markup', () => {
    const root = buildSegmentPopupDom({
      name: 'X',
      level: 'low',
      total: '<script>alert(1)</script>',
      free: 1,
    })
    expect(root.querySelector('script')).toBeNull()
    expect(root.textContent).not.toContain('<script>')
  })

  it('includes pressure line when p is finite (incl. numeric string)', () => {
    const root = buildSegmentPopupDom({ name: 'Seg', level: 'medium', p: '0.42' })
    expect(root.textContent).toContain('Getting busy')
    expect(root.textContent).toContain('42% signal')
  })

  it('omits pressure suffix when p is not finite', () => {
    const root = buildSegmentPopupDom({ name: 'Seg', level: 'quiet', p: NaN })
    expect(root.textContent).not.toContain('% signal')
    expect(root.textContent).toContain('No live estimate')
  })

  it('shows user-friendly bay and coverage labels', () => {
    const root = buildSegmentPopupDom({ name: 'Seg', level: 'low', total: 3, free: 2 })
    expect(root.textContent).toContain('Good parking chance')
    expect(root.textContent).toContain('2 of 3 bays free')
    expect(root.textContent).toContain('Limited live data')
  })
})
