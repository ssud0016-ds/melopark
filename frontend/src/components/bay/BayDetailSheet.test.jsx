import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import BayDetailSheet from './BayDetailSheet'

vi.mock('../../services/apiBays', () => ({
  fetchBayEvaluation: vi.fn(),
}))

const { fetchBayEvaluation } = await import('../../services/apiBays')

function renderSheetWithCoverage(coverage) {
  fetchBayEvaluation.mockResolvedValue({
    bay_id: '1000',
    verdict: 'yes',
    reason: 'ok',
    active_restriction: null,
    warning: null,
    data_source: coverage === 'none' ? 'unknown' : 'db',
    data_coverage: coverage,
  })

  render(
    <BayDetailSheet
      bay={{
        id: '1000',
        type: 'available',
        bayType: 'Other',
        hasRules: true,
        free: 1,
        name: 'Test St',
        sensorLastUpdated: null,
      }}
      destination={null}
      onClose={() => {}}
      isMobile={false}
      lastUpdated={null}
    />
  )
}

describe('BayDetailSheet coverage badge', () => {
  it('shows Live status + rules for full coverage', async () => {
    renderSheetWithCoverage('full')
    expect(await screen.findByText('Live status + rules')).toBeInTheDocument()
  })

  it('shows Rules only — no live status for rules_only coverage', async () => {
    renderSheetWithCoverage('rules_only')
    expect(await screen.findByText('Rules only — no live status')).toBeInTheDocument()
  })

  it('shows No data badge and signage text for none coverage', async () => {
    renderSheetWithCoverage('none')
    expect(await screen.findByText('No data — check signage')).toBeInTheDocument()
    expect(await screen.findByText('Sensor only — check the sign.')).toBeInTheDocument()
    expect(screen.queryByText('Full rules available')).not.toBeInTheDocument()
  })

  it('shows amber badge and warning banner for partial_signage coverage', async () => {
    renderSheetWithCoverage('partial_signage')
    expect(await screen.findByText('Check bay sign — sign type not captured')).toBeInTheDocument()
    expect(await screen.findByText('Sign type not captured')).toBeInTheDocument()
  })
})

describe('BayDetailSheet planner time contract', () => {
  beforeEach(() => {
    cleanup()
    fetchBayEvaluation.mockClear()
    if (!Element.prototype.scrollIntoView) {
      Element.prototype.scrollIntoView = () => {}
    }
  })

  it('shows Melbourne-time helper text in planner panel', async () => {
    fetchBayEvaluation.mockResolvedValue({
      bay_id: '1000',
      verdict: 'yes',
      reason: 'ok',
      active_restriction: null,
      warning: null,
      data_source: 'db',
      data_coverage: 'full',
    })

    render(
      <BayDetailSheet
        bay={{
          id: '1000',
          type: 'available',
          bayType: 'Other',
          hasRules: true,
          free: 1,
          name: 'Test St',
          sensorLastUpdated: null,
        }}
        destination={null}
        onClose={() => {}}
        isMobile={false}
        lastUpdated={null}
      />
    )

    const planButton = screen.getAllByRole('button').find((btn) => btn.textContent?.includes('Plan ahead'))
    fireEvent.click(planButton)
    expect(await screen.findByText('Times are Melbourne time (AEST/AEDT).')).toBeInTheDocument()
  })

  it('sends naive arrival_iso from planner (no timezone offset)', async () => {
    fetchBayEvaluation.mockResolvedValue({
      bay_id: '1000',
      verdict: 'yes',
      reason: 'ok',
      active_restriction: null,
      warning: null,
      data_source: 'db',
      data_coverage: 'full',
    })

    render(
      <BayDetailSheet
        bay={{
          id: '1000',
          type: 'available',
          bayType: 'Other',
          hasRules: true,
          free: 1,
          name: 'Test St',
          sensorLastUpdated: null,
        }}
        destination={null}
        onClose={() => {}}
        isMobile={false}
        lastUpdated={null}
      />
    )

    const planButton = screen.getAllByRole('button').find((btn) => btn.textContent?.includes('Plan ahead'))
    fireEvent.click(planButton)

    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-12-22' } })
    fireEvent.change(screen.getByLabelText('Time'), { target: { value: '14:00' } })

    await waitFor(
      () => {
        const plannerCall = fetchBayEvaluation.mock.calls.find(
          (c) => c?.[1]?.arrivalIso === '2026-12-22T14:00:00'
        )
        expect(plannerCall).toBeTruthy()
      },
      { timeout: 2500 }
    )

    const plannerCall = fetchBayEvaluation.mock.calls.find(
      (c) => c?.[1]?.arrivalIso === '2026-12-22T14:00:00'
    )
    expect(plannerCall[1].arrivalIso).not.toMatch(/[+-]\d{2}:\d{2}$/)
    expect(plannerCall[1].arrivalIso.endsWith('Z')).toBe(false)
  })
})
