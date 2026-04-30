import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import BayDetailSheet from './BayDetailSheet'

vi.mock('../../services/apiBays', () => ({
  fetchBayEvaluation: vi.fn(),
}))

const { fetchBayEvaluation } = await import('../../services/apiBays')

function renderSheetWithEvaluation(evaluation, props = {}) {
  fetchBayEvaluation.mockResolvedValue({
    bay_id: '1000',
    verdict: 'yes',
    reason: 'ok',
    active_restriction: null,
    warning: null,
    data_source: 'db',
    data_coverage: 'full',
    translator_rules: [],
    ...(evaluation ?? {}),
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
      {...props}
    />
  )
}

describe('BayDetailSheet parking tab UI', () => {
  beforeEach(() => {
    cleanup()
    fetchBayEvaluation.mockClear()
  })

  it('renders the key sections from the parking-tab design', async () => {
    renderSheetWithEvaluation({
      translator_rules: [
        {
          state: 'current',
          banner: 'THIS RULE IS CURRENTLY IN EFFECT',
          heading: 'Monday to Friday from 9:30 AM to 7:30 PM',
          body: 'You can park, but only for 2 hour. Pay the meter.',
        },
        {
          state: 'outside',
          heading: 'Outside all these times (nights, public holidays)',
          body: "You're free to park with no limit and no payment.",
        },
      ],
    })

    await waitFor(() => expect(fetchBayEvaluation).toHaveBeenCalled())
    expect(screen.getByText('Currently Showing:')).toBeInTheDocument()
    expect(screen.getByText('Please update the time filter to plan ahead')).toBeInTheDocument()
    expect(screen.getByText('Bay Status and Limits')).toBeInTheDocument()
    expect(screen.getByText('Parking Sign Translator')).toBeInTheDocument()

    expect(screen.getByText('THIS RULE IS CURRENTLY IN EFFECT')).toBeInTheDocument()
    expect(screen.getByText('Monday to Friday from 9:30 AM to 7:30 PM')).toBeInTheDocument()
    expect(screen.getByText("Outside all these times (nights, public holidays)")).toBeInTheDocument()
  })

  it('sends planner params with timezone-aware arrival_iso (Melbourne offset)', async () => {
    const aware = '2026-12-22T14:00:00+11:00'
    renderSheetWithEvaluation(
      { translator_rules: [] },
      {
        savedPlannerArrivalIso: aware,
        savedPlannerDurationMins: 120,
      },
    )

    await waitFor(() => {
      const plannerCall = fetchBayEvaluation.mock.calls.find((c) => c?.[1]?.arrivalIso === aware)
      expect(plannerCall).toBeTruthy()
    })

    const plannerCall = fetchBayEvaluation.mock.calls.find((c) => c?.[1]?.arrivalIso === aware)
    expect(plannerCall[1].durationMins).toBe(120)
    expect(plannerCall[1].arrivalIso).toMatch(/[+-]\d{2}:\d{2}$/)
  })

  it('requests live evaluation when planner props are absent', async () => {
    renderSheetWithEvaluation({ translator_rules: [] })

    await waitFor(() => {
      expect(fetchBayEvaluation).toHaveBeenCalled()
    })
    const first = fetchBayEvaluation.mock.calls[0]
    expect(first[0]).toBe('1000')
    expect(first[1]).toBeNull()
  })
})
