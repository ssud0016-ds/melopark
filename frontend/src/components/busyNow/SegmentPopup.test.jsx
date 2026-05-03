import { describe, it, expect, vi, beforeEach } from 'vitest'
import { cleanup, render, screen, fireEvent } from '@testing-library/react'
import SegmentPopup from './SegmentPopup'

vi.mock('../map/ParkingMap', () => ({
  getStatusFillColor: vi.fn(() => '#112233'),
}))

const baseDetail = {
  street_name: 'Test St',
  seg_descr: null,
  level: 'high',
  trend: 'up',
  pressure: 0.77,
  total_bays: 10,
  free_bays: 3,
  has_live_bays: true,
  occ_pct: 70,
  events_nearby: [
    { event_name: 'Big Game', distance_m: 100, start_iso: '2026-05-02T18:00:00' },
    { event_name: 'Concert Hall Show', distance_m: 200, start_iso: '2026-05-02T19:00:00' },
    { event_name: 'Third Event', distance_m: 300, start_iso: '2026-05-02T20:00:00' },
  ],
}

describe('SegmentPopup', () => {
  beforeEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('renders parking chance, % taken, coverage, reasons, and trend aria-label', () => {
    render(<SegmentPopup detail={baseDetail} colorBlindMode={false} />)
    expect(screen.getByText(/Hard to park/)).toBeInTheDocument()
    expect(screen.getByText(/70% taken/)).toBeInTheDocument()
    expect(screen.getByText(/Live bays/)).toBeInTheDocument()
    expect(screen.getByText(/77% pressure signal/)).toBeInTheDocument()
    expect(screen.getByText(/Why: Bays filling up · Traffic rising · Event nearby/)).toBeInTheDocument()
    expect(screen.getByLabelText('rising')).toBeInTheDocument()
  })

  it('shows at most two event chips and +1 for extras', () => {
    render(<SegmentPopup detail={baseDetail} />)
    const dialog = screen.getByRole('dialog', { name: /street parking chance detail/i })
    expect(dialog).toBeInTheDocument()
    expect(dialog.textContent).toContain('Big Game')
    expect(dialog.textContent).toContain('Concert Hall Show')
    expect(dialog.textContent).toContain('+1')
    expect(dialog.textContent).not.toContain('Third Event')
  })

  it('calls onRequestClose on Escape', () => {
    const onRequestClose = vi.fn()
    render(<SegmentPopup detail={baseDetail} onRequestClose={onRequestClose} />)
    const dialog = screen.getByRole('dialog', { name: /street parking chance detail/i })
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(onRequestClose).toHaveBeenCalledTimes(1)
  })

  it('uses falling aria-label when trend is down', () => {
    render(
      <SegmentPopup
        detail={{ ...baseDetail, trend: 'down' }}
        onRequestClose={() => {}}
      />,
    )
    expect(screen.getByLabelText('falling')).toBeInTheDocument()
  })

  it('shows no live bay coverage when sample is unavailable', () => {
    render(
      <SegmentPopup
        detail={{ ...baseDetail, has_live_bays: false, occ_pct: null }}
      />,
    )
    expect(screen.getByText(/No live bay coverage/)).toBeInTheDocument()
    expect(screen.queryByText(/of 10 bays free/)).not.toBeInTheDocument()
  })
})
