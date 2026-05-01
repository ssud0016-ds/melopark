import { cleanup, render, screen, waitFor, fireEvent } from '@testing-library/react'
import { useState } from 'react'
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

  it('does not let current occupancy override future yes verdict', async () => {
    const futureIso = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
    fetchBayEvaluation.mockResolvedValue({
      bay_id: '1000',
      verdict: 'yes',
      reason: 'Rules allow parking at selected time.',
      active_restriction: null,
      warning: null,
      data_source: 'db',
      data_coverage: 'full',
      translator_rules: [],
    })

    render(
      <BayDetailSheet
        bay={{
          id: '1000',
          type: 'occupied',
          bayType: 'Other',
          hasRules: true,
          free: 0,
          name: 'Test St',
          sensorLastUpdated: null,
        }}
        destination={null}
        onClose={() => {}}
        isMobile={false}
        lastUpdated={null}
        savedPlannerArrivalIso={futureIso}
        savedPlannerDurationMins={120}
      />,
    )

    await waitFor(() => expect(fetchBayEvaluation).toHaveBeenCalled())
    expect(await screen.findByText('YES')).toBeInTheDocument()
    expect(screen.getByText('You can park here')).toBeInTheDocument()
    expect(screen.getByText('SPACE OCCUPIED')).toBeInTheDocument()
  })

  it('keeps future no verdict as no when bay is currently occupied', async () => {
    const futureIso = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
    fetchBayEvaluation.mockResolvedValue({
      bay_id: '1000',
      verdict: 'no',
      reason: 'Restriction active at selected time.',
      active_restriction: {
        typedesc: 'No Stopping',
        rule_category: 'clearway',
        plain_english: 'No stopping applies',
        max_stay_mins: null,
        expires_at: null,
      },
      warning: null,
      data_source: 'db',
      data_coverage: 'full',
      translator_rules: [],
    })

    render(
      <BayDetailSheet
        bay={{
          id: '1000',
          type: 'occupied',
          bayType: 'Other',
          hasRules: true,
          free: 0,
          name: 'Test St',
          sensorLastUpdated: null,
        }}
        destination={null}
        onClose={() => {}}
        isMobile={false}
        lastUpdated={null}
        savedPlannerArrivalIso={futureIso}
        savedPlannerDurationMins={120}
      />,
    )

    await waitFor(() => expect(fetchBayEvaluation).toHaveBeenCalled())
    expect(await screen.findByText('NO')).toBeInTheDocument()
    expect(screen.getByText('You cannot park here')).toBeInTheDocument()
    expect(screen.getByText('SPACE OCCUPIED')).toBeInTheDocument()
  })

  it('keeps current-time occupied override behavior', async () => {
    fetchBayEvaluation.mockResolvedValue({
      bay_id: '1000',
      verdict: 'yes',
      reason: 'Rules allow parking now.',
      active_restriction: null,
      warning: null,
      data_source: 'db',
      data_coverage: 'full',
      translator_rules: [],
    })

    render(
      <BayDetailSheet
        bay={{
          id: '1000',
          type: 'occupied',
          bayType: 'Other',
          hasRules: true,
          free: 0,
          name: 'Test St',
          sensorLastUpdated: null,
        }}
        destination={null}
        onClose={() => {}}
        isMobile={false}
        lastUpdated={null}
      />,
    )

    await waitFor(() => expect(fetchBayEvaluation).toHaveBeenCalled())
    expect(await screen.findByText('NO')).toBeInTheDocument()
    expect(screen.getByText('You cannot park here')).toBeInTheDocument()
    expect(screen.getByText('SPACE OCCUPIED')).toBeInTheDocument()
  })
})

describe('BayDetailSheet responsive layout', () => {
  beforeEach(() => {
    cleanup()
    fetchBayEvaluation.mockClear()
  })

  it('uses full-width classes on mobile', async () => {
    fetchBayEvaluation.mockResolvedValue({
      bay_id: '1000',
      verdict: 'yes',
      reason: 'ok',
      active_restriction: null,
      warning: null,
      data_source: 'db',
      data_coverage: 'full',
      translator_rules: [],
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
        isMobile
        lastUpdated={null}
      />,
    )
    await waitFor(() => expect(fetchBayEvaluation).toHaveBeenCalled())
    const dialog = screen.getByRole('dialog', { name: /parking details/i })
    expect(dialog.className).toContain('w-full')
    expect(dialog.className).toContain('max-w-full')
    expect(dialog.className).toContain('inset-x-0')
  })

  it('desktop sheet does not use 44vw cap and sets min/max width for readability', async () => {
    fetchBayEvaluation.mockResolvedValue({
      bay_id: '1000',
      verdict: 'yes',
      reason: 'ok',
      active_restriction: null,
      warning: null,
      data_source: 'db',
      data_coverage: 'full',
      translator_rules: [],
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
      />,
    )
    await waitFor(() => expect(fetchBayEvaluation).toHaveBeenCalled())
    const dialog = screen.getByRole('dialog', { name: /parking details/i })
    expect(dialog.className).not.toContain('44vw')
    expect(dialog.className).toContain('min-w-[280px]')
    expect(dialog.className).toContain('max-w-[min(420px,calc(100vw-24px))]')
    expect(dialog.className).toContain('w-[380px]')
  })
})

describe('BayDetailSheet focus and keyboard', () => {
  beforeEach(() => {
    cleanup()
    fetchBayEvaluation.mockClear()
  })

  it('sets aria-modal and moves initial focus to the close control', async () => {
    renderSheetWithEvaluation({ translator_rules: [] })
    const dialog = await screen.findByRole('dialog', { name: /parking details/i })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus()
    })
  })

  it('calls onClose when Escape is pressed', async () => {
    const onClose = vi.fn()
    fetchBayEvaluation.mockResolvedValue({
      bay_id: '1000',
      verdict: 'yes',
      reason: 'ok',
      active_restriction: null,
      warning: null,
      data_source: 'db',
      data_coverage: 'full',
      translator_rules: [],
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
        onClose={onClose}
        isMobile={false}
        lastUpdated={null}
      />,
    )
    await waitFor(() => expect(fetchBayEvaluation).toHaveBeenCalled())
    fireEvent.keyDown(document, { key: 'Escape', bubbles: true })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('restores focus to the element that had focus before open', async () => {
    fetchBayEvaluation.mockResolvedValue({
      bay_id: '1000',
      verdict: 'yes',
      reason: 'ok',
      active_restriction: null,
      warning: null,
      data_source: 'db',
      data_coverage: 'full',
      translator_rules: [],
    })

    function Harness() {
      const [open, setOpen] = useState(false)
      return (
        <div>
          <button type="button" data-testid="before-sheet" onClick={() => setOpen(true)}>
            Open sheet
          </button>
          {open ? (
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
              onClose={() => setOpen(false)}
              isMobile={false}
              lastUpdated={null}
            />
          ) : null}
        </div>
      )
    }

    render(<Harness />)
    const opener = screen.getByTestId('before-sheet')
    opener.focus()
    expect(opener).toHaveFocus()
    fireEvent.click(opener)

    await screen.findByRole('dialog')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus())

    fireEvent.keyDown(document, { key: 'Escape', bubbles: true })
    await waitFor(() => expect(opener).toHaveFocus())
  })

  it('keeps Tab inside the dialog when there is only one focusable control', async () => {
    fetchBayEvaluation.mockResolvedValue({
      bay_id: '1000',
      verdict: 'yes',
      reason: 'x'.repeat(500),
      active_restriction: null,
      warning: null,
      data_source: 'db',
      data_coverage: 'full',
      translator_rules: [],
    })

    function Harness() {
      const [open, setOpen] = useState(true)
      return (
        <div>
          <button type="button" data-testid="outside">
            Outside
          </button>
          {open ? (
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
              onClose={() => setOpen(false)}
              isMobile={false}
              lastUpdated={null}
            />
          ) : null}
        </div>
      )
    }

    render(<Harness />)
    const closeBtn = await screen.findByRole('button', { name: 'Close' })
    await waitFor(() => expect(closeBtn).toHaveFocus())
    const outside = screen.getByTestId('outside')
    fireEvent.keyDown(document, { key: 'Tab', bubbles: true })
    expect(closeBtn).toHaveFocus()
    expect(outside).not.toHaveFocus()
  })
})
