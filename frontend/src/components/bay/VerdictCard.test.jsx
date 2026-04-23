import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import VerdictCard from './VerdictCard'

describe('VerdictCard data_coverage behavior', () => {
  it('does not claim none-active rules when coverage is none', () => {
    render(
      <VerdictCard
        bay={{ id: '1000', type: 'available', bayType: 'Other' }}
        evaluationPending={false}
        evaluation={{
          verdict: 'yes',
          reason: 'Restriction data not available – check signage on site',
          active_restriction: null,
          warning: null,
          data_source: 'unknown',
          data_coverage: 'none',
        }}
      />
    )

    expect(screen.queryByText('None active at this time')).not.toBeInTheDocument()
    expect(screen.queryByText('None active')).not.toBeInTheDocument()
    expect(screen.getByText('Restriction data not available – check signage on site')).toBeInTheDocument()
  })
})
