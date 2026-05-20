import { fireEvent, render, screen } from '@testing-library/react-native';

import { ScopeStrip } from '../ScopeStrip';

jest.mock('../../../hooks/useFilters', () => ({
  useFilters: () => ({
    isDefault: true,
    modifiedPills: [],
  }),
}));

jest.mock('../../../hooks/useThemeColors', () => ({
  useThemeColors: () => ({
    liveChipBg: '#e8f8f2',
    liveChipText: '#047857',
    chrome: '#ffffff',
    chromeMuted: '#f1f5f9',
    tabActive: '#4338ca',
  }),
}));

describe('ScopeStrip', () => {
  it('shows Live now when no proximity counts', () => {
    render(<ScopeStrip onOpenFilters={jest.fn()} />);
    expect(screen.getByText('Live now')).toBeTruthy();
  });

  it('shows proximity chip instead of Live now when free bays exist', () => {
    render(<ScopeStrip onOpenFilters={jest.fn()} proxFreeBays={3} proxFreeSpots={3} />);
    expect(screen.getByText('3 free · 400m')).toBeTruthy();
    expect(screen.queryByText('Live now')).toBeNull();
  });

  it('opens filters from button', () => {
    const onOpenFilters = jest.fn();
    render(<ScopeStrip onOpenFilters={onOpenFilters} proxFreeBays={2} proxFreeSpots={2} />);
    fireEvent.press(screen.getByLabelText('Open filters'));
    expect(onOpenFilters).toHaveBeenCalledTimes(1);
  });
});
