import { fireEvent, render, screen } from '@testing-library/react-native';

import { MapLegend } from '../MapLegend';

describe('MapLegend', () => {
  it('shows compact Legend chip by default', () => {
    render(<MapLegend colorBlindMode={false} />);
    expect(screen.getByLabelText('Show legend')).toBeTruthy();
    expect(screen.getByText('Legend')).toBeTruthy();
    expect(screen.queryByText('Verified bays')).toBeNull();
  });

  it('expands to verified bays and street rows on tap', () => {
    render(<MapLegend colorBlindMode={false} parkingChanceActive />);
    fireEvent.press(screen.getByLabelText('Show legend'));
    expect(screen.getByText('Verified bays')).toBeTruthy();
    expect(screen.getByText('Available parking spots')).toBeTruthy();
    expect(screen.getByText('Good chance street')).toBeTruthy();
    expect(screen.getByText('About parking chance')).toBeTruthy();
  });

  it('collapses when hide is pressed', () => {
    render(<MapLegend colorBlindMode={false} />);
    fireEvent.press(screen.getByLabelText('Show legend'));
    fireEvent.press(screen.getByLabelText('Hide legend'));
    expect(screen.getByLabelText('Show legend')).toBeTruthy();
    expect(screen.queryByText('Verified bays')).toBeNull();
  });
});
