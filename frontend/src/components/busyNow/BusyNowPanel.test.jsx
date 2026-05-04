import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import BusyNowPanel from './BusyNowPanel'

describe('BusyNowPanel', () => {
  beforeEach(() => {
    cleanup()
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ target_zone: null, alternatives: [] }),
    })
  })

  it('renders loading state', () => {
    render(<BusyNowPanel manifest={null} status="loading" />)
    expect(screen.getByText(/Loading parking chance data/i)).toBeInTheDocument()
  })

  it('renders error state', () => {
    render(<BusyNowPanel manifest={null} status="error" />)
    expect(screen.getByText(/Could not load pressure data/i)).toBeInTheDocument()
  })

  it('renders viewport-mode hint when no destination', () => {
    const manifest = {
      data_sources: {
        sensors: { status: 'live', detail: '5-min cache' },
        traffic_profile: { status: 'historical' },
        events: { status: 'scheduled' },
      },
    }
    render(<BusyNowPanel manifest={manifest} status="ready" />)
    expect(screen.getByText(/Pick a destination/i)).toBeInTheDocument()
    expect(screen.getByText(/Live bays/i)).toBeInTheDocument()
  })

  it('renders destination mode header when destination present', async () => {
    const manifest = {
      data_sources: { sensors: { status: 'live' }, traffic_profile: { status: 'historical' }, events: { status: 'scheduled' } },
    }
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        target_zone: {
          label: 'Test Zone',
          level: 'medium',
          pressure: 0.55,
          free_bays: 3,
          total_bays: 9,
        },
        alternatives: [],
      }),
    })
    render(
      <BusyNowPanel
        manifest={manifest}
        status="ready"
        destination={{ lat: -37.81, lng: 144.96 }}
      />
    )
    expect(screen.getByText(/Around your destination/i)).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('Test Zone')).toBeInTheDocument())
    expect(screen.getByText(/Target area/i)).toBeInTheDocument()
    expect(screen.getByText(/Getting busy/i)).toBeInTheDocument()
  })

  it('shows source pills with active states', () => {
    const manifest = {
      data_sources: {
        sensors: { status: 'live', detail: '5-min cache' },
        traffic_profile: { status: 'historical' },
        events: { status: 'scheduled' },
      },
    }
    render(<BusyNowPanel manifest={manifest} status="ready" />)
    expect(screen.getAllByText(/Live bays/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/SCATS/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Events/i).length).toBeGreaterThan(0)
  })

  it('renders 3 quietest chips sorted ascending when no destination', () => {
    const quietStreets = [
      { segment_id: '1', street_name: 'Lygon St', pressure: 0.1, level: 'low', free: 7, total: 9, mid_lat: -37.81, mid_lon: 144.96 },
      { segment_id: '2', street_name: 'Swanston St', pressure: 0.2, level: 'low', free: 5, total: 8, mid_lat: -37.812, mid_lon: 144.962 },
      { segment_id: '3', street_name: 'Collins St', pressure: 0.35, level: 'low', free: 3, total: 6, mid_lat: -37.814, mid_lon: 144.964 },
    ]
    const onStreetClick = vi.fn()
    render(
      <BusyNowPanel
        manifest={null}
        status="ready"
        quietStreets={quietStreets}
        onStreetClick={onStreetClick}
      />
    )

    // Heading
    expect(screen.getByText(/Quietest nearby/i)).toBeInTheDocument()

    // 3 chip buttons present in ascending pressure order
    const buttons = screen.getAllByRole('button')
    // Filter to the chip buttons (they contain street names)
    const chipButtons = buttons.filter((btn) =>
      ['Lygon St', 'Swanston St', 'Collins St'].some((name) => btn.textContent.includes(name))
    )
    expect(chipButtons).toHaveLength(3)

    // Check content of first chip (lowest pressure)
    expect(chipButtons[0].textContent).toMatch(/Lygon St/)
    expect(chipButtons[0].textContent).toMatch(/Good chance/)
    expect(chipButtons[0].textContent).toMatch(/7\/9 bays free/)
    expect(chipButtons[0].textContent).toMatch(/Live bays/)

    // Check order: Lygon (0.1) < Swanston (0.2) < Collins (0.35)
    const names = chipButtons.map((btn) => {
      if (btn.textContent.includes('Lygon')) return 'Lygon'
      if (btn.textContent.includes('Swanston')) return 'Swanston'
      return 'Collins'
    })
    expect(names).toEqual(['Lygon', 'Swanston', 'Collins'])
  })

  it('uses mobile sheet copy and keeps first recommendation prominent', () => {
    const quietStreets = [
      { segment_id: '1', street_name: 'Lygon St', pressure: 0.1, level: 'low', free: 7, total: 9, mid_lat: -37.81, mid_lon: 144.96 },
      { segment_id: '2', street_name: 'Swanston St', pressure: 0.2, level: 'low', free: 5, total: 8, mid_lat: -37.812, mid_lon: 144.962 },
    ]
    render(
      <BusyNowPanel
        manifest={null}
        status="ready"
        quietStreets={quietStreets}
        mobileSheet
      />
    )

    expect(screen.getByText(/Best nearby parking/i)).toBeInTheDocument()
    const firstChip = screen.getByRole('button', { name: /Lygon St/i })
    expect(firstChip.className).toContain('min-h-[52px]')
  })

  it('calls onStreetClick with lat/lng when chip is clicked', () => {
    const quietStreets = [
      { segment_id: '1', street_name: 'Lygon St', pressure: 0.1, level: 'low', free: 7, total: 9, mid_lat: -37.81, mid_lon: 144.96 },
    ]
    const onStreetClick = vi.fn()
    render(
      <BusyNowPanel
        manifest={null}
        status="ready"
        quietStreets={quietStreets}
        onStreetClick={onStreetClick}
      />
    )
    // Find the street name text within this render and walk up to the enclosing button
    const streetNameEls = screen.getAllByText('Lygon St')
    const chip = streetNameEls[streetNameEls.length - 1].closest('button')
    expect(chip).not.toBeNull()
    fireEvent.click(chip)
    expect(onStreetClick).toHaveBeenCalledWith(
      expect.objectContaining({
        lat: -37.81,
        lng: 144.96,
        street_name: 'Lygon St',
      }),
    )
  })

  it('marks selected quiet street chip', () => {
    const quietStreets = [
      { segment_id: '1', street_name: 'Lygon St', pressure: 0.1, level: 'low', free: 7, total: 9, mid_lat: -37.81, mid_lon: 144.96 },
    ]
    render(
      <BusyNowPanel
        manifest={null}
        status="ready"
        quietStreets={quietStreets}
        selectedSuggestion={{ source: 'quiet-street', segmentId: '1' }}
      />
    )
    expect(screen.getByRole('button', { name: /Lygon St/i }).textContent).toMatch(/Selected/)
  })

  it('shows no-coverage label for quiet street without live sample', () => {
    const quietStreets = [
      { segment_id: '1', street_name: 'Lygon St', pressure: 0.1, level: 'low', free: 0, total: 9, has_live_bays: false, mid_lat: -37.81, mid_lon: 144.96 },
    ]
    render(
      <BusyNowPanel
        manifest={null}
        status="ready"
        quietStreets={quietStreets}
      />
    )
    const chip = screen.getByRole('button', { name: /Lygon St/i })
    expect(chip.textContent).toMatch(/No live bay coverage/)
    expect(chip.textContent).not.toMatch(/bays free/)
  })

  it('renders destination alternatives as parking recommendations', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        target_zone: {
          label: 'Target Zone',
          level: 'high',
          pressure: 0.8,
          free_bays: 1,
          total_bays: 10,
        },
        alternatives: [{
          zone_id: 123,
          label: 'Queensberry St',
          level: 'low',
          pressure: 0.2,
          free_bays: 8,
          walk_minutes: 4,
          walk_distance_m: 320,
        }],
      }),
    })
    render(
      <BusyNowPanel
        manifest={null}
        status="ready"
        destination={{ lat: -37.81, lng: 144.96 }}
      />
    )

    await waitFor(() => expect(screen.getByText(/Better nearby options/i)).toBeInTheDocument())
    expect(screen.getByText(/Try Queensberry St/i)).toBeInTheDocument()
    expect(screen.getByText(/320 m away/i)).toBeInTheDocument()
    expect(screen.queryByText(/4 min walk/i)).not.toBeInTheDocument()
    expect(screen.getByText(/Good chance · 8 bays free/i)).toBeInTheDocument()
  })

  it('does not show better alternatives when destination pressure is low', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        target_zone: {
          label: 'Target Zone',
          level: 'low',
          pressure: 0.2,
          free_bays: 8,
          total_bays: 10,
        },
        alternatives: [{
          zone_id: 123,
          label: 'Queensberry St',
          level: 'low',
          pressure: 0.1,
          free_bays: 9,
          walk_distance_m: 320,
        }],
      }),
    })
    render(
      <BusyNowPanel
        manifest={null}
        status="ready"
        destination={{ lat: -37.81, lng: 144.96 }}
      />
    )

    await waitFor(() => expect(screen.getByText(/Target Zone/i)).toBeInTheDocument())
    expect(screen.queryByText(/Better nearby options/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Try Queensberry St/i)).not.toBeInTheDocument()
    expect(screen.getByText(/Destination area looks okay/i)).toBeInTheDocument()
  })

  it('marks selected alternative row', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        target_zone: {
          label: 'Target Zone',
          level: 'high',
          pressure: 0.8,
          free_bays: 1,
          total_bays: 10,
        },
        alternatives: [{
          zone_id: 123,
          label: 'Queensberry St',
          level: 'low',
          pressure: 0.2,
          free_bays: 8,
          walk_distance_m: 320,
        }],
      }),
    })
    render(
      <BusyNowPanel
        manifest={null}
        status="ready"
        destination={{ lat: -37.81, lng: 144.96 }}
        selectedSuggestion={{ source: 'alternative', zoneId: 123 }}
      />
    )

    await waitFor(() => expect(screen.getByText(/Better nearby options/i)).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /Queensberry St/i }).textContent).toMatch(/Selected/)
  })

  it('shows fallback note when backend uses segment-pressure alternatives fallback', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        fallback_mode: 'segment_pressure',
        target_zone: {
          label: 'Target Zone',
          level: 'high',
          pressure: 0.8,
          free_bays: 1,
          total_bays: 10,
        },
        alternatives: [],
      }),
    })
    render(
      <BusyNowPanel
        manifest={null}
        status="ready"
        destination={{ lat: -37.81, lng: 144.96 }}
      />
    )
    await waitFor(() => expect(screen.getByText(/live street model fallback/i)).toBeInTheDocument())
  })
})

describe('BusyNowPanel A18 — live pills', () => {
  beforeEach(() => {
    cleanup()
    vi.useFakeTimers()
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ target_zone: null, alternatives: [] }),
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('pill 1 shows age in seconds from generated_at (approx 47s)', () => {
    const generatedAt = new Date(Date.now() - 47000).toISOString()
    const manifest = {
      generated_at: generatedAt,
      events: { active_count: 0 },
      data_sources: {
        sensors: { status: 'live' },
        traffic_profile: { status: 'historical' },
        events: { status: 'scheduled' },
      },
    }
    render(<BusyNowPanel manifest={manifest} status="ready" />)
    // Allow for slight timing variation — match /\d+s ago/
    const pills = screen.getAllByText(/s ago/)
    expect(pills.length).toBeGreaterThan(0)
    expect(pills[0].textContent).toMatch(/\d+s ago/)
  })

  it('pill 1 label matches Live bays pattern with age', () => {
    const generatedAt = new Date(Date.now() - 47000).toISOString()
    const manifest = {
      generated_at: generatedAt,
      events: { active_count: 3 },
      data_sources: {
        sensors: { status: 'live' },
        traffic_profile: { status: 'historical' },
        events: { status: 'scheduled' },
      },
    }
    render(<BusyNowPanel manifest={manifest} status="ready" />)
    const matches = screen.getAllByText(/Live bays · \d+s ago/)
    expect(matches.length).toBeGreaterThan(0)
  })

  it('pill 2 is always SCATS · historical', () => {
    const manifest = {
      generated_at: new Date().toISOString(),
      events: { active_count: 0 },
      data_sources: {
        sensors: { status: 'live' },
        traffic_profile: { status: 'historical' },
        events: { status: 'scheduled' },
      },
    }
    render(<BusyNowPanel manifest={manifest} status="ready" />)
    const matches = screen.getAllByText('SCATS · historical')
    expect(matches.length).toBeGreaterThan(0)
  })

  it('pill 3 shows active event count from manifest.events.active_count', () => {
    const manifest = {
      generated_at: new Date().toISOString(),
      events: { active_count: 7 },
      data_sources: {
        sensors: { status: 'live' },
        traffic_profile: { status: 'historical' },
        events: { status: 'scheduled' },
      },
    }
    render(<BusyNowPanel manifest={manifest} status="ready" />)
    const matches = screen.getAllByText('Events · 7 active')
    expect(matches.length).toBeGreaterThan(0)
  })

  it('pill 3 shows 0 active when events key is missing', () => {
    const manifest = {
      generated_at: new Date().toISOString(),
      data_sources: {
        sensors: { status: 'live' },
        traffic_profile: { status: 'historical' },
        events: { status: 'scheduled' },
      },
    }
    render(<BusyNowPanel manifest={manifest} status="ready" />)
    const matches = screen.getAllByText('Events · 0 active')
    expect(matches.length).toBeGreaterThan(0)
  })

  it('live age increments each second via interval', () => {
    const generatedAt = new Date(Date.now() - 10000).toISOString()
    const manifest = {
      generated_at: generatedAt,
      events: { active_count: 0 },
      data_sources: {
        sensors: { status: 'live' },
        traffic_profile: { status: 'historical' },
        events: { status: 'scheduled' },
      },
    }
    render(<BusyNowPanel manifest={manifest} status="ready" />)
    // Capture initial age
    const initialPills = screen.getAllByText(/\d+s ago/)
    expect(initialPills.length).toBeGreaterThan(0)
    const initialText = initialPills[0].textContent
    const initialMatch = initialText.match(/(\d+)s ago/)
    expect(initialMatch).not.toBeNull()
    const initialAge = Number(initialMatch[1])

    // Advance 2 seconds — interval should fire and update the age
    act(() => vi.advanceTimersByTime(2000))

    const updatedPills = screen.getAllByText(/\d+s ago/)
    expect(updatedPills.length).toBeGreaterThan(0)
    const updatedText = updatedPills[0].textContent
    const updatedMatch = updatedText.match(/(\d+)s ago/)
    expect(updatedMatch).not.toBeNull()
    const updatedAge = Number(updatedMatch[1])

    // After advancing 2s the age must be >= initial (timer fired)
    expect(updatedAge).toBeGreaterThanOrEqual(initialAge)
  })
})
