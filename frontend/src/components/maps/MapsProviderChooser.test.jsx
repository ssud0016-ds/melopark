import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import MapsProviderChooser from './MapsProviderChooser'

function setup(props = {}) {
  const onConfirm = vi.fn()
  const onClose = vi.fn()
  const onClear = vi.fn()
  const utils = render(
    <MapsProviderChooser
      open
      onConfirm={onConfirm}
      onClose={onClose}
      onClear={onClear}
      {...props}
    />,
  )
  return { ...utils, onConfirm, onClose, onClear }
}

describe('MapsProviderChooser', () => {
  it('renders three radios', () => {
    setup()
    expect(screen.getByLabelText(/Google Maps/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Apple Maps/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Browser fallback/)).toBeInTheDocument()
  })

  it('pre-selects initialProvider', () => {
    setup({ initialProvider: 'apple' })
    expect(screen.getByLabelText(/Apple Maps/).checked).toBe(true)
  })

  it('Remember my choice default checked when shown', () => {
    setup()
    expect(screen.getByLabelText(/Remember my choice/).checked).toBe(true)
  })

  it('confirm fires onConfirm with selection + remember', () => {
    const { onConfirm } = setup()
    fireEvent.click(screen.getByLabelText(/Apple Maps/))
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(onConfirm).toHaveBeenCalledWith('apple', true)
  })

  it('cancel button fires onClose', () => {
    const { onClose } = setup()
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onClose).toHaveBeenCalled()
  })

  it('Escape closes', () => {
    const { onClose } = setup()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('does not render when open=false', () => {
    render(<MapsProviderChooser open={false} onConfirm={() => {}} onClose={() => {}} />)
    expect(screen.queryByText(/Choose your maps app/)).not.toBeInTheDocument()
  })

  it('Clear button visible only with showClear', () => {
    const { onClear, onClose } = setup({ showClear: true, showRemember: false })
    const clear = screen.getByRole('button', { name: /clear preference/i })
    fireEvent.click(clear)
    expect(onClear).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('confirm uses remember=true when showRemember=false (settings flow)', () => {
    const { onConfirm } = setup({ showRemember: false, initialProvider: 'web' })
    fireEvent.click(screen.getByRole('button', { name: /continue|save/i }))
    expect(onConfirm).toHaveBeenCalledWith('web', true)
  })
})
