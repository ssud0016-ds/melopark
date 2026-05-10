import { describe, expect, it, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import MapsProviderSettingRow from './MapsProviderSettingRow'
import { MAPS_PROVIDER_STORAGE_KEY } from '../../hooks/useMapsProvider'

beforeEach(() => {
  window.localStorage.clear()
})

describe('MapsProviderSettingRow', () => {
  it('shows "Not set" when no preference', () => {
    render(<MapsProviderSettingRow />)
    expect(screen.getByText('Not set')).toBeInTheDocument()
  })

  it('shows provider label when saved', () => {
    window.localStorage.setItem(MAPS_PROVIDER_STORAGE_KEY, 'apple')
    render(<MapsProviderSettingRow />)
    expect(screen.getByText('Apple Maps')).toBeInTheDocument()
  })

  it('opens chooser on click and saves on confirm', () => {
    render(<MapsProviderSettingRow />)
    fireEvent.click(screen.getByRole('button', { name: /Maps provider/ }))
    expect(screen.getByText(/Choose your maps app/)).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText(/Apple Maps/))
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    expect(window.localStorage.getItem(MAPS_PROVIDER_STORAGE_KEY)).toBe('apple')
    expect(screen.getByText('Apple Maps')).toBeInTheDocument()
  })

  it('Clear preference removes saved value', () => {
    window.localStorage.setItem(MAPS_PROVIDER_STORAGE_KEY, 'google')
    render(<MapsProviderSettingRow />)
    fireEvent.click(screen.getByRole('button', { name: /Maps provider/ }))
    fireEvent.click(screen.getByRole('button', { name: /clear preference/i }))
    expect(window.localStorage.getItem(MAPS_PROVIDER_STORAGE_KEY)).toBe(null)
    expect(screen.getByText('Not set')).toBeInTheDocument()
  })
})
