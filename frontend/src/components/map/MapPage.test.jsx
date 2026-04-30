import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import MapPage from './MapPage'

vi.mock('../../hooks/useMapState', () => ({
  useMapState: () => ({
    selectedBayId: null,
    setSelectedBayId: vi.fn(),
    activeFilter: 'all',
    setActiveFilter: vi.fn(),
    destination: null,
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

vi.mock('./ParkingMap', () => ({
  default: function MockParkingMap() {
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

function setViewportWidth(w) {
  Object.defineProperty(window, 'innerWidth', { value: w, configurable: true, writable: true })
}

describe('MapPage toolbar layout', () => {
  beforeEach(() => {
    cleanup()
  })

  it('stacks search, status, and map controls in one column on mobile', () => {
    setViewportWidth(414)
    render(<MapPage bays={[]} lastUpdated={null} apiError={null} apiLoading={false} onRetry={undefined} />)
    expect(screen.getByTestId('map-toolbar-mobile-stack')).toBeInTheDocument()
    expect(screen.queryByTestId('map-toolbar-desktop')).not.toBeInTheDocument()
  })

  it('uses desktop-centered toolbar and separate right control column on wide viewports', () => {
    setViewportWidth(1200)
    render(<MapPage bays={[]} lastUpdated={null} apiError={null} apiLoading={false} onRetry={undefined} />)
    expect(screen.getByTestId('map-toolbar-desktop')).toBeInTheDocument()
    expect(screen.queryByTestId('map-toolbar-mobile-stack')).not.toBeInTheDocument()
  })
})

describe('MapPage verified bays legend', () => {
  beforeEach(() => {
    cleanup()
  })

  it('shows full Verified bays legend by default on desktop with status labels', () => {
    setViewportWidth(1200)
    render(<MapPage bays={[]} lastUpdated={null} apiError={null} apiLoading={false} onRetry={undefined} />)
    expect(screen.getByText('Verified bays')).toBeInTheDocument()
    expect(screen.getByText('Available parking spots')).toBeInTheDocument()
    expect(screen.getByText('Caution: Tow Away / Loading Zone')).toBeInTheDocument()
    expect(screen.getByText('Parking spots occupied')).toBeInTheDocument()
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
})
