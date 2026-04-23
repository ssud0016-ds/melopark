import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import TimelineStrip from './TimelineStrip'

describe('TimelineStrip', () => {
  it('shows formatted leave-by time, not raw ISO', () => {
    render(
      <TimelineStrip
        verdict="yes"
        sensorFree={1}
        activeRestriction={{
          max_stay_mins: 120,
          expires_at: '2026-04-14T11:00:00+10:00',
        }}
      />
    )

    expect(screen.getByText('Leave by')).toBeInTheDocument()
    expect(screen.getByText('11:00 am')).toBeInTheDocument()
    expect(screen.queryByText('2026-04-14T11:00:00+10:00')).not.toBeInTheDocument()
    expect(screen.queryByText(/\+10:00/)).not.toBeInTheDocument()
  })
})
