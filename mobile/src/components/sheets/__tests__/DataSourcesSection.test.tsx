import { fireEvent, render, screen } from '@testing-library/react-native';

import { DataSourcesSection, manifestAgeSec } from '../DataSourcesSection';

jest.mock('../../../hooks/useDarkMode', () => ({
  useDarkMode: () => ({ dark: false, toggle: jest.fn(), setTheme: jest.fn() }),
}));

const manifest = {
  tile_url_template: '/api/pressure/tiles/{z}/{x}/{y}.mvt',
  generated_at: new Date(Date.now() - 42_000).toISOString(),
  data_sources: {
    sensors: { status: 'live', detail: '5-min cache' },
    traffic_profile: { status: 'historical' },
    events: { status: 'scheduled' },
  },
  events: { active_count: 3 },
};

describe('manifestAgeSec', () => {
  it('returns seconds since generated_at', () => {
    const at = '2026-01-01T12:00:00+11:00';
    expect(manifestAgeSec(at, new Date('2026-01-01T12:00:45+11:00').getTime())).toBe(45);
  });
});

describe('DataSourcesSection', () => {
  it('expands source pills when Data sources is pressed', () => {
    render(<DataSourcesSection manifest={manifest} />);
    expect(screen.queryByText(/Live bays/i)).toBeNull();
    fireEvent.press(screen.getByLabelText('Data sources'));
    expect(screen.getByText(/Live bays/i)).toBeTruthy();
    expect(screen.getByText(/SCATS/i)).toBeTruthy();
    expect(screen.getByText(/Events · 3 active/i)).toBeTruthy();
  });
});
