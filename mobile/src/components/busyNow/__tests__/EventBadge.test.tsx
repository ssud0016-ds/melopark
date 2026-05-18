import { render, screen } from '@testing-library/react-native';

import { EventBadge } from '../EventBadge';

const threeEvents = [
  { event_name: 'Big Game', start_iso: '2026-05-02T18:00:00' },
  { event_name: 'Concert Hall Show', start_iso: '2026-05-02T19:00:00' },
  { event_name: 'Third Event', start_iso: '2026-05-02T20:00:00' },
];

describe('EventBadge', () => {
  test('shows at most two event chips and +1 for extras (web parity)', () => {
    render(<EventBadge events={threeEvents} />);
    expect(screen.getByText('Big Game')).toBeTruthy();
    expect(screen.getByText('Concert Hall Show')).toBeTruthy();
    expect(screen.getByText('+1')).toBeTruthy();
    expect(screen.queryByText('Third Event')).toBeNull();
  });

  test('renders nothing when events empty', () => {
    const { toJSON } = render(<EventBadge events={[]} />);
    expect(toJSON()).toBeNull();
  });

  test('chip accessibilityLabel includes name and start_iso', () => {
    render(
      <EventBadge
        events={[{ event_name: 'Big Game', start_iso: '2026-05-02T18:00:00' }]}
      />,
    );
    expect(screen.getByLabelText('Big Game · 2026-05-02T18:00:00')).toBeTruthy();
  });

  test('+N suffix has accessibility label', () => {
    render(<EventBadge events={threeEvents} />);
    expect(screen.getByLabelText('1 more events nearby')).toBeTruthy();
  });

  test('uses name field when event_name missing', () => {
    render(<EventBadge events={[{ name: 'Arena Show' }]} />);
    expect(screen.getByText('Arena Show')).toBeTruthy();
  });
});
