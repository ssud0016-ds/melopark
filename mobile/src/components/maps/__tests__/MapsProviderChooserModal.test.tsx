import { fireEvent, render, screen } from '@testing-library/react-native';

import { MapsProviderChooserModal } from '../MapsProviderChooserModal';

jest.mock('../../../hooks/useDarkMode', () => ({
  useDarkMode: () => ({ dark: false, toggle: jest.fn(), setTheme: jest.fn() }),
}));

describe('MapsProviderChooserModal', () => {
  it('does not render panel when not visible', () => {
    render(
      <MapsProviderChooserModal
        visible={false}
        onConfirm={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    expect(screen.queryByTestId('maps-provider-chooser')).toBeNull();
  });

  it('calls onConfirm with selected provider', () => {
    const onConfirm = jest.fn();
    render(
      <MapsProviderChooserModal visible onConfirm={onConfirm} onClose={jest.fn()} />,
    );
    fireEvent.press(screen.getByLabelText('Waze. Crowd-sourced traffic + navigation'));
    fireEvent.press(screen.getByLabelText('Continue'));
    expect(onConfirm).toHaveBeenCalledWith('waze', true);
  });

  it('calls onClose from Cancel', () => {
    const onClose = jest.fn();
    render(
      <MapsProviderChooserModal visible onConfirm={jest.fn()} onClose={onClose} />,
    );
    fireEvent.press(screen.getByLabelText('Cancel'));
    expect(onClose).toHaveBeenCalled();
  });
});
