import { cleanup, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import PressureLegend from './PressureLegend'

describe('PressureLegend', () => {
  beforeEach(() => {
    cleanup()
  })

  it('renders the Parking Pressure title', () => {
    render(<PressureLegend />)
    expect(screen.getByText('Parking Pressure')).toBeInTheDocument()
  })

  it('renders Quiet, Moderate, and Busy labels with descriptions', () => {
    render(<PressureLegend />)
    expect(screen.getByText('Quiet')).toBeInTheDocument()
    expect(screen.getByText('Moderate')).toBeInTheDocument()
    expect(screen.getByText('Busy')).toBeInTheDocument()
    expect(screen.getByText('Plenty of parking')).toBeInTheDocument()
    expect(screen.getByText('Some bays available')).toBeInTheDocument()
    expect(screen.getByText('Limited parking')).toBeInTheDocument()
  })

  it('renders three color swatches with expected heatmap palette', () => {
    const { container } = render(<PressureLegend />)
    const swatches = container.querySelectorAll(
      'span.inline-block.h-3.w-3.rounded-sm[style*="background-color"]',
    )
    expect(swatches.length).toBe(3)
    const styles = [...swatches].map((el) => el.getAttribute('style') || '')
    expect(styles.some((s) => s.includes('163, 236, 72'))).toBe(true)
    expect(styles.some((s) => s.includes('255, 179, 130'))).toBe(true)
    expect(styles.some((s) => s.includes('237, 104, 104'))).toBe(true)
  })

  it('includes static dark-mode Tailwind classes on the card', () => {
    const { container } = render(<PressureLegend />)
    const card = container.firstElementChild
    expect(card).toBeTruthy()
    expect(card.className).toMatch(/dark:border-gray-700\/60/)
    expect(card.className).toMatch(/dark:bg-surface-dark-secondary\/95/)
  })
})
