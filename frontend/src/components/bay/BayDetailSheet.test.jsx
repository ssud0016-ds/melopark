<<<<<<< HEAD
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
=======
import { cleanup, render, screen, waitFor } from '@testing-library/react'
>>>>>>> origin/main
import { beforeEach, describe, expect, it, vi } from 'vitest'

import BayDetailSheet from './BayDetailSheet'

vi.mock('../../services/apiBays', () => ({
  fetchBayEvaluation: vi.fn(),
}))

const { fetchBayEvaluation } = await import('../../services/apiBays')

<<<<<<< HEAD
/** Coverage badge lives under the collapsed Details section — expand it first. */
async function openDetailsPanel() {
  await waitFor(() => {
    expect(fetchBayEvaluation).toHaveBeenCalled()
  })
  // Target the expander that controls the details panel (name "Details" can match more than one node in RTL)
  const detailsBtn = document.querySelector('button[aria-controls="bay-details-panel"]')
  expect(detailsBtn).toBeTruthy()
  fireEvent.click(detailsBtn)
}

function renderSheetWithCoverage(coverage) {
=======
function renderSheetWithEvaluation(evaluation, props = {}) {
>>>>>>> origin/main
  fetchBayEvaluation.mockResolvedValue({
    bay_id: '1000',
    verdict: 'yes',
    reason: 'ok',
    active_restriction: null,
    warning: null,
<<<<<<< HEAD
    data_source: coverage === 'none' ? 'unknown' : 'db',
    data_coverage: coverage,
=======
    data_source: 'db',
    data_coverage: 'full',
    translator_rules: [],
    ...(evaluation ?? {}),
>>>>>>> origin/main
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
<<<<<<< HEAD
=======
      {...props}
>>>>>>> origin/main
    />
  )
}

<<<<<<< HEAD
describe('BayDetailSheet coverage badge', () => {
=======
describe('BayDetailSheet parking tab UI', () => {
>>>>>>> origin/main
  beforeEach(() => {
    cleanup()
    fetchBayEvaluation.mockClear()
  })

<<<<<<< HEAD
  it('shows Live status + rules for full coverage', async () => {
    renderSheetWithCoverage('full')
    await openDetailsPanel()
    expect(await screen.findByText('Live status + rules')).toBeInTheDocument()
  })

  it('shows Rules only — no live status for rules_only coverage', async () => {
    renderSheetWithCoverage('rules_only')
    await openDetailsPanel()
    expect(await screen.findByText('Rules only. No live status.')).toBeInTheDocument()
  })

  it('shows No data badge and signage text for none coverage', async () => {
    renderSheetWithCoverage('none')
    await openDetailsPanel()
    expect(await screen.findByText('No data. Check signage.')).toBeInTheDocument()
    expect(await screen.findByText('Sensor only. Check the sign.')).toBeInTheDocument()
    expect(screen.queryByText('Full rules available')).not.toBeInTheDocument()
  })

  it('shows amber badge and warning banner for partial_signage coverage', async () => {
    renderSheetWithCoverage('partial_signage')
    await openDetailsPanel()
    expect(await screen.findByText('Check bay sign. Sign type not captured.')).toBeInTheDocument()
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
=======
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

  it('sends planner params contract from parent (naive arrival_iso)', async () => {
    renderSheetWithEvaluation(
      { translator_rules: [] },
      {
        savedPlannerArrivalIso: '2026-12-22T14:00:00',
        savedPlannerDurationMins: 120,
      },
    )

    await waitFor(() => {
      const plannerCall = fetchBayEvaluation.mock.calls.find(
        (c) => c?.[1]?.arrivalIso === '2026-12-22T14:00:00',
      )
      expect(plannerCall).toBeTruthy()
    })

    const plannerCall = fetchBayEvaluation.mock.calls.find(
      (c) => c?.[1]?.arrivalIso === '2026-12-22T14:00:00',
    )
    expect(plannerCall[1].durationMins).toBe(120)
    expect(plannerCall[1].arrivalIso).not.toMatch(/[+-]\d{2}:\d{2}$/)
    expect(plannerCall[1].arrivalIso.endsWith('Z')).toBe(false)
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
>>>>>>> origin/main
})
