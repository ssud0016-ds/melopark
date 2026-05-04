import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import MapPage from './MapPage'
import { getStatusFillColor } from './ParkingMap'
import * as useBusyNowModule from '../../hooks/useBusyNow'

const mockMapState = vi.hoisted(() => ({ destination: null }))

vi.mock('../../hooks/useMapState', () => ({
  useMapState: () => ({
    selectedBayId: null,
    setSelectedBayId: vi.fn(),
    activeFilter: 'all',
    setActiveFilter: vi.fn(),
    destination: mockMapState.destination,
    pickDestination: vi.fn(),
    clearDestination: vi.fn(),
    sheetSnap: 0,
    setSheetSnap: vi.fn(),
    showLimitedBays: false,
    setShowLimitedBays: vi.fn(),
    accessibilityMode: false,
    setAccessibilityMode: vi.fn(),
    setBaysRef: vi.fn(),
    getVisibleBays: (bays) => bays,
    getProximityBays: (bays) => bays,
    defaultMapCenter: [-37.81, 144.96],
    defaultMapZoom: 16,
    destinationMapZoom: 18,
  }),
}))

vi.mock('../../services/apiBays', () => ({
  fetchAccessibilityNearby: vi.fn().mockResolvedValue({ bays: [] }),
  fetchEvaluateBulk: vi.fn().mockResolvedValue([]),
}))

const mockParkingMap = vi.fn(() => <div data-testid="mock-parking-map" />)

vi.mock('./ParkingMap', () => ({
  getStatusFillColor: vi.fn((status, colorBlindMode) => {
    if (colorBlindMode) {
      if (status === 'available') return '#3b82f6'
      if (status === 'caution') return '#f59e0b'
      if (status === 'occupied') return '#374151'
    }
    if (status === 'available') return '#a3ec48'
    if (status === 'caution') return '#FFB382'
    return '#ed6868'
  }),
  default: function MockParkingMap(props) {
    mockParkingMap(props)
    return <div data-testid="mock-parking-map" />
  },
}))

vi.mock('../search/SearchBar', () => ({
  default: function MockSearchBar() {
    return <div data-testid="mock-search-bar" />
  },
}))

vi.mock('../bay/BayDetailSheet', () => ({
  default: function MockBayDetailSheet() {
    return null
  },
}))

vi.mock('./OnboardingOverlay', () => ({
  default: function MockOnboarding() {
    return null
  },
}))

vi.mock('../feedback/FilterChips', () => ({
  default: function MockFilterChips() {
    return <div data-testid="mock-filter-chips" />
  },
}))

const mockBusyNowPanel = vi.fn(() => <div data-testid="mock-busy-now-panel" />)
vi.mock('../busyNow/BusyNowPanel', () => ({
  default: function MockBusyNowPanel(props) {
    mockBusyNowPanel(props)
    return <div data-testid="mock-busy-now-panel" />
  },
}))

vi.mock('../../hooks/useBusyNow', () => ({
  useBusyNow: vi.fn((enabled) => ({
    manifest: enabled
      ? { minute_bucket: 1, tile_url_template: '/tiles', total_segments: 5 }
      : null,
    status: enabled ? 'ready' : 'idle',
  })),
}))

vi.mock('../../services/apiPressure', () => ({
  fetchSegmentDetail: vi.fn().mockResolvedValue(null),
  buildTileUrlTemplate: vi.fn().mockReturnValue(null),
  fetchQuietestSegments: vi.fn().mockResolvedValue([]),
}))

function setViewportWidth(w) {
  Object.defineProperty(window, 'innerWidth', { value: w, configurable: true, writable: true })
}

beforeEach(() => {
  mockMapState.destination = null
})

describe('MapPage toolbar layout', () => {
  beforeEach(() => {
    cleanup()
  })

  it('stacks search, status, and map controls in one column on mobile', () => {
    setViewportWidth(414)
    render(<MapPage bays={[]} lastUpdated={null} apiError={null} apiLoading={false} onRetry={undefined} />)
    expect(screen.getByTestId('map-toolbar-mobile-stack')).toBeInTheDocument()
    expect(screen.queryByTestId('map-toolbar-desktop')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /accessibility mode/i })).not.toBeInTheDocument()
  })

  it('uses desktop-centered toolbar and separate right control column on wide viewports', () => {
    setViewportWidth(1200)
    render(<MapPage bays={[]} lastUpdated={null} apiError={null} apiLoading={false} onRetry={undefined} />)
    expect(screen.getByTestId('map-toolbar-desktop')).toBeInTheDocument()
    expect(screen.queryByTestId('map-toolbar-mobile-stack')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /accessibility mode/i })).not.toBeInTheDocument()
  })
})

describe('MapPage alt-pin (Phase 2 — A11)', () => {
  beforeEach(() => {
    cleanup()
    mockParkingMap.mockClear()
    mockBusyNowPanel.mockClear()
  })

  it('passes dimRadiusM=600 to ParkingMap', () => {
    setViewportWidth(1200)
    render(<MapPage bays={[]} lastUpdated={null} apiError={null} apiLoading={false} onRetry={undefined} />)
    const props = mockParkingMap.mock.calls.at(-1)?.[0]
    expect(props?.dimRadiusM).toBe(600)
    expect(props?.altPinPos).toBeNull()
  })

  it('mounts altPinPos on ParkingMap when BusyNowPanel reports an alt click', async () => {
    setViewportWidth(1200)
    render(<MapPage bays={[]} lastUpdated={null} apiError={null} apiLoading={false} onRetry={undefined} />)

    // Panel is part of the main map and exposes the alternative handler.
    const panelProps = mockBusyNowPanel.mock.calls.at(-1)?.[0]
    expect(typeof panelProps.onAlternativeClick).toBe('function')

    // Fire an alternative click with known coords.
    await act(async () => {
      panelProps.onAlternativeClick({
        centroid_lat: -37.8123,
        centroid_lon: 144.9612,
        name: 'Drummond St',
      })
    })

    const mapProps = mockParkingMap.mock.calls.at(-1)?.[0]
    expect(mapProps.altPinPos).toEqual({
      lat: -37.8123,
      lng: 144.9612,
      name: 'Drummond St',
      subtitle: '',
      source: 'alternative',
      zoneId: undefined,
    })
  })

  it('mounts a less-busy street pin when BusyNowPanel reports a quiet street click', async () => {
    setViewportWidth(1200)
    render(<MapPage bays={[]} lastUpdated={null} apiError={null} apiLoading={false} onRetry={undefined} />)

    const panelProps = mockBusyNowPanel.mock.calls.at(-1)?.[0]
    expect(typeof panelProps.onStreetClick).toBe('function')

    await act(async () => {
      panelProps.onStreetClick({
        street_name: 'Lygon St',
        segment_id: 'seg-1',
        level: 'low',
        free: 7,
        total: 9,
        mid_lat: -37.81,
        mid_lon: 144.96,
        lat: -37.81,
        lng: 144.96,
      })
    })

    const mapProps = mockParkingMap.mock.calls.at(-1)?.[0]
    expect(mapProps.altPinPos).toEqual({
      lat: -37.81,
      lng: 144.96,
      name: 'Lygon St',
      subtitle: 'Good chance · 7/9 bays free',
      source: 'quiet-street',
      segmentId: 'seg-1',
    })
  })

  it('clears selected less-busy pick with Escape on desktop', async () => {
    setViewportWidth(1200)
    render(<MapPage bays={[]} lastUpdated={null} apiError={null} apiLoading={false} onRetry={undefined} />)

    const panelProps = mockBusyNowPanel.mock.calls.at(-1)?.[0]
    await act(async () => {
      panelProps.onAlternativeClick({
        centroid_lat: -37.8123,
        centroid_lon: 144.9612,
        name: 'Drummond St',
      })
    })
    expect(mockParkingMap.mock.calls.at(-1)?.[0]?.altPinPos).not.toBeNull()

    await act(async () => {
      fireEvent.keyDown(window, { key: 'Escape' })
    })

    expect(mockParkingMap.mock.calls.at(-1)?.[0]?.altPinPos).toBeNull()
  })

  it('clears selected less-busy pick when ParkingMap reports blank map click', async () => {
    setViewportWidth(1200)
    render(<MapPage bays={[]} lastUpdated={null} apiError={null} apiLoading={false} onRetry={undefined} />)

    const panelProps = mockBusyNowPanel.mock.calls.at(-1)?.[0]
    await act(async () => {
      panelProps.onAlternativeClick({
        centroid_lat: -37.8123,
        centroid_lon: 144.9612,
        name: 'Drummond St',
      })
    })
    expect(mockParkingMap.mock.calls.at(-1)?.[0]?.altPinPos).not.toBeNull()

    await act(async () => {
      mockParkingMap.mock.calls.at(-1)?.[0]?.onMapEmptyClick()
    })

    expect(mockParkingMap.mock.calls.at(-1)?.[0]?.altPinPos).toBeNull()
  })
})

describe('MapPage verified bays legend', () => {
  beforeEach(() => {
    cleanup()
    mockParkingMap.mockClear()
  })

  it('shows full Verified bays legend by default on desktop with status labels', () => {
    setViewportWidth(1200)
    const { container } = render(<MapPage bays={[]} lastUpdated={null} apiError={null} apiLoading={false} onRetry={undefined} />)
    expect(screen.getByText('Verified bays')).toBeInTheDocument()
    expect(screen.getByText('Available parking spots')).toBeInTheDocument()
    expect(screen.getByText('Caution: Tow Away / Loading Zone')).toBeInTheDocument()
    expect(screen.getByText('Parking spots occupied')).toBeInTheDocument()
    expect(container.querySelector('.legend-symbol-available')).toBeTruthy()
    expect(container.querySelector('.legend-symbol-caution')).toBeTruthy()
    expect(container.querySelector('.legend-symbol-occupied')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Show legend' })).not.toBeInTheDocument()
  })

  it('starts with compact Legend on mobile and expands to show Verified bays and Hide legend', () => {
    setViewportWidth(414)
    render(<MapPage bays={[]} lastUpdated={null} apiError={null} apiLoading={false} onRetry={undefined} />)
    expect(screen.getByRole('button', { name: 'Show legend' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Hide legend' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Show legend' }))

    expect(screen.getByText('Verified bays')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Hide legend' })).toBeInTheDocument()
    expect(screen.getByText('Available parking spots')).toBeInTheDocument()
  })

  it('toggles color-blind mode and passes mode to ParkingMap', () => {
    setViewportWidth(1200)
    render(<MapPage bays={[]} lastUpdated={null} apiError={null} apiLoading={false} onRetry={undefined} />)

    expect(screen.getByRole('button', { name: 'Enable color-blind mode' })).toBeInTheDocument()
    expect(mockParkingMap).toHaveBeenCalled()
    const initialProps = mockParkingMap.mock.calls.at(-1)?.[0]
    expect(initialProps?.colorBlindMode).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: 'Enable color-blind mode' }))

    expect(screen.getByRole('button', { name: 'Disable color-blind mode' })).toBeInTheDocument()
    const toggledProps = mockParkingMap.mock.calls.at(-1)?.[0]
    expect(toggledProps?.colorBlindMode).toBe(true)
  })

  it('keeps legend labels and switches legend palette in color-blind mode', () => {
    setViewportWidth(1200)
    render(<MapPage bays={[]} lastUpdated={null} apiError={null} apiLoading={false} onRetry={undefined} />)

    const available = document.querySelector('.legend-symbol-available')
    expect(available).toBeTruthy()
    expect(available?.getAttribute('style') || '').toContain('rgb(163, 236, 72)')
    expect(screen.getByText('Available parking spots')).toBeInTheDocument()
    expect(screen.getByText('Caution: Tow Away / Loading Zone')).toBeInTheDocument()
    expect(screen.getByText('Parking spots occupied')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Enable color-blind mode' }))

    const availableCb = document.querySelector('.legend-symbol-available')
    expect(availableCb).toBeTruthy()
    expect(availableCb?.getAttribute('style') || '').toContain('rgb(59, 130, 246)')
    expect(getStatusFillColor).toHaveBeenCalledWith('available', true)
  })
})

describe('MapPage parking chance main-map integration', () => {
  const defaultImpl = (enabled) => ({
    manifest: enabled
      ? { minute_bucket: 1, tile_url_template: '/tiles', total_segments: 5 }
      : null,
    status: 'ready',
  })

  beforeEach(() => {
    cleanup()
    mockParkingMap.mockClear()
    mockBusyNowPanel.mockClear()
    vi.mocked(useBusyNowModule.useBusyNow).mockImplementation(defaultImpl)
  })

  afterEach(() => {
    vi.mocked(useBusyNowModule.useBusyNow).mockImplementation(defaultImpl)
  })

  it('loads parking chance data as part of the main map', () => {
    setViewportWidth(1200)
    render(<MapPage bays={[]} lastUpdated={null} apiError={null} apiLoading={false} onRetry={undefined} />)
    expect(useBusyNowModule.useBusyNow).toHaveBeenCalledWith(true)
    expect(screen.queryByRole('button', { name: /parking chance overlay/i })).not.toBeInTheDocument()
  })

  it('renders parking chance inside a mobile bottom decision sheet', () => {
    setViewportWidth(414)
    render(<MapPage bays={[]} lastUpdated={null} apiError={null} apiLoading={false} onRetry={undefined} />)

    expect(screen.getByText('Best nearby parking')).toBeInTheDocument()
    expect(screen.getByText(/Quiet streets around current map view/i)).toBeInTheDocument()
    expect(mockBusyNowPanel.mock.calls.at(-1)?.[0]?.mobileSheet).toBe(true)
    expect(screen.queryByLabelText('Total parking bays on the live feed')).not.toBeInTheDocument()
  })

  it('keeps parking chance as floating desktop panel', () => {
    setViewportWidth(1200)
    render(<MapPage bays={[]} lastUpdated={null} apiError={null} apiLoading={false} onRetry={undefined} />)

    expect(mockBusyNowPanel.mock.calls.at(-1)?.[0]?.mobileSheet).toBeUndefined()
    expect(screen.queryByText('Best nearby parking')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Total parking bays on the live feed')).toBeInTheDocument()
  })

  it('shows selected pick in mobile sheet and clears via thumb-safe button', async () => {
    setViewportWidth(414)
    render(<MapPage bays={[]} lastUpdated={null} apiError={null} apiLoading={false} onRetry={undefined} />)

    const panelProps = mockBusyNowPanel.mock.calls.at(-1)?.[0]
    await act(async () => {
      panelProps.onStreetClick({
        street_name: 'Lygon St',
        segment_id: 'seg-1',
        level: 'low',
        free: 7,
        total: 9,
        mid_lat: -37.81,
        mid_lon: 144.96,
        lat: -37.81,
        lng: 144.96,
      })
    })

    expect(screen.getAllByText('Less busy pick').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Lygon St').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Clear pick' })).toBeInTheDocument()
    expect(mockParkingMap.mock.calls.at(-1)?.[0]?.altPinPos).not.toBeNull()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Clear pick' }))
    })

    expect(mockParkingMap.mock.calls.at(-1)?.[0]?.altPinPos).toBeNull()
  })

  it('does not mount the vector layer while manifest is loading, but keeps panel visible', () => {
    vi.mocked(useBusyNowModule.useBusyNow).mockReturnValue({ manifest: null, status: 'loading' })
    setViewportWidth(1200)
    render(<MapPage bays={[]} lastUpdated={null} apiError={null} apiLoading={false} onRetry={undefined} />)
    const mapProps = mockParkingMap.mock.calls.at(-1)?.[0]
    expect(mapProps?.busyNow).toBe(false)
    expect(mockBusyNowPanel.mock.calls.at(-1)?.[0]?.status).toBe('loading')
  })

  it('does not mount the vector layer when manifest has zero segments', () => {
    vi.mocked(useBusyNowModule.useBusyNow).mockReturnValue({
      manifest: { total_segments: 0, minute_bucket: 0, tile_url_template: '/tiles' },
      status: 'ready',
    })
    setViewportWidth(1200)
    render(<MapPage bays={[]} lastUpdated={null} apiError={null} apiLoading={false} onRetry={undefined} />)
    const mapProps = mockParkingMap.mock.calls.at(-1)?.[0]
    expect(mapProps?.busyNow).toBe(false)
  })

  it('mounts the vector layer when manifest has segments and status is ready', () => {
    vi.mocked(useBusyNowModule.useBusyNow).mockReturnValue({
      manifest: { total_segments: 5, minute_bucket: 1, tile_url_template: '/tiles' },
      status: 'ready',
    })
    setViewportWidth(1200)
    render(<MapPage bays={[]} lastUpdated={null} apiError={null} apiLoading={false} onRetry={undefined} />)
    const mapProps = mockParkingMap.mock.calls.at(-1)?.[0]
    expect(mapProps?.busyNow).toBe(true)
    expect(mockBusyNowPanel).toHaveBeenCalled()
  })

  it('keeps parking chance integrated when a destination is set', () => {
    mockMapState.destination = { lat: -37.81, lng: 144.96, name: 'RMIT' }
    vi.mocked(useBusyNowModule.useBusyNow).mockImplementation(defaultImpl)
    setViewportWidth(1200)
    render(<MapPage bays={[]} lastUpdated={null} apiError={null} apiLoading={false} onRetry={undefined} />)

    const mapProps = mockParkingMap.mock.calls.at(-1)?.[0]
    expect(mapProps?.busyNow).toBe(true)
    expect(mockBusyNowPanel).toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: /parking chance overlay/i })).not.toBeInTheDocument()
  })

  it('does not mount the vector layer when status is error', () => {
    vi.mocked(useBusyNowModule.useBusyNow).mockReturnValue({
      manifest: null,
      status: 'error',
    })
    setViewportWidth(1200)
    render(<MapPage bays={[]} lastUpdated={null} apiError={null} apiLoading={false} onRetry={undefined} />)
    const mapProps = mockParkingMap.mock.calls.at(-1)?.[0]
    expect(mapProps?.busyNow).toBe(false)
  })
})
