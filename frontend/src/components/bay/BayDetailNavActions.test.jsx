import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import BayDetailNavActions from './BayDetailNavActions'
import { resetCounters, getCounters } from '../../utils/analytics'
import { MAPS_PROVIDER_STORAGE_KEY } from '../../hooks/useMapsProvider'

const BAY = { id: 1, lat: -37.8136, lng: 144.9631 }
const BAY_NO_COORDS = { id: 2 }
const DEST = { lat: -37.81, lng: 144.97 }

let openSpy
beforeEach(() => {
  vi.useFakeTimers()
  window.localStorage.clear()
  resetCounters()
  Object.defineProperty(window.navigator, 'userAgent', {
    value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    configurable: true,
  })
  openSpy = vi.spyOn(window, 'open').mockImplementation(() => ({}))
})
afterEach(() => {
  vi.useRealTimers()
  openSpy.mockRestore()
})

describe('BayDetailNavActions', () => {
  it('shows inline error on Navigate tap when bay coords invalid (AC 7.1.3)', () => {
    render(<BayDetailNavActions bay={BAY_NO_COORDS} destination={null} />)
    expect(screen.getByRole('button', { name: /Navigate to bay/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Navigate to bay/ }))
    expect(screen.getByRole('alert')).toHaveTextContent(/unavailable/i)
    expect(openSpy).not.toHaveBeenCalled()
  })

  it('renders Navigate when coords valid', () => {
    render(<BayDetailNavActions bay={BAY} destination={null} />)
    expect(screen.getByRole('button', { name: /Navigate to bay/ })).toBeInTheDocument()
  })

  it('hides Walk and shows muted note when no destination (AC 7.3.2)', () => {
    render(<BayDetailNavActions bay={BAY} destination={null} />)
    expect(
      screen.queryByRole('button', { name: /Walk to destination/ }),
    ).not.toBeInTheDocument()
    expect(screen.getByText(/Set a destination/)).toBeInTheDocument()
  })

  it('shows Walk when destination set', () => {
    render(<BayDetailNavActions bay={BAY} destination={DEST} />)
    expect(
      screen.getByRole('button', { name: /Walk to destination/ }),
    ).toBeInTheDocument()
  })

  it('saved provider → tap Navigate launches directly', () => {
    window.localStorage.setItem(MAPS_PROVIDER_STORAGE_KEY, 'google')
    render(<BayDetailNavActions bay={BAY} destination={null} />)
    fireEvent.click(screen.getByRole('button', { name: /Navigate to bay/ }))
    expect(openSpy).toHaveBeenCalled()
    expect(getCounters()['nav.navigate.tap']).toBe(1)
    expect(screen.queryByText(/Choose your maps app/)).not.toBeInTheDocument()
  })

  it('no saved provider → opens chooser; confirm launches and saves', () => {
    render(<BayDetailNavActions bay={BAY} destination={null} />)
    fireEvent.click(screen.getByRole('button', { name: /Navigate to bay/ }))
    expect(screen.getByText(/Choose your maps app/)).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText(/Apple Maps/))
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(window.localStorage.getItem(MAPS_PROVIDER_STORAGE_KEY)).toBe('apple')
    expect(openSpy).toHaveBeenCalled()
  })

  it('apple-on-desktop launch surfaces inline notice', () => {
    window.localStorage.setItem(MAPS_PROVIDER_STORAGE_KEY, 'apple')
    render(<BayDetailNavActions bay={BAY} destination={null} />)
    fireEvent.click(screen.getByRole('button', { name: /Navigate to bay/ }))
    expect(screen.getByRole('status')).toHaveTextContent(
      /Couldn't open Apple Maps/,
    )
  })

  it('Walk + saved provider → fires nav.walk.tap with bay origin', () => {
    window.localStorage.setItem(MAPS_PROVIDER_STORAGE_KEY, 'web')
    render(<BayDetailNavActions bay={BAY} destination={DEST} />)
    fireEvent.click(screen.getByRole('button', { name: /Walk to destination/ }))
    expect(getCounters()['nav.walk.tap']).toBe(1)
    const url = openSpy.mock.calls[0][0]
    expect(url).toContain('travelmode=walking')
    expect(url).toContain(`origin=${encodeURIComponent('-37.8136,144.9631')}`)
    expect(url).toContain(`destination=${encodeURIComponent('-37.81,144.97')}`)
  })

  it('chooser cancel does not fire counter', () => {
    render(<BayDetailNavActions bay={BAY} destination={null} />)
    fireEvent.click(screen.getByRole('button', { name: /Navigate to bay/ }))
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(getCounters()['nav.navigate.tap']).toBeUndefined()
  })
})
