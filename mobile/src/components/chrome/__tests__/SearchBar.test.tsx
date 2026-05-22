import { act, createRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { MAP_SEARCH_COPY } from '../../../content/searchCopy';
import { SearchBar, type SearchBarRef } from '../SearchBar';

jest.mock('../../../hooks/useDarkMode', () => ({
  useDarkMode: () => ({ dark: false, toggle: jest.fn(), setTheme: jest.fn() }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const baseProps = {
  destination: null,
  onPick: jest.fn(),
  onClear: jest.fn(),
  onSettingsOpen: jest.fn(),
  variant: 'map' as const,
};

describe('SearchBar dismiss', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses streets and landmarks placeholder copy', () => {
    render(<SearchBar {...baseProps} />);
    expect(screen.getByPlaceholderText(MAP_SEARCH_COPY.placeholder)).toBeTruthy();
  });

  it('notifies onFocusChange when input is focused', () => {
    const onFocusChange = jest.fn();
    render(<SearchBar {...baseProps} onFocusChange={onFocusChange} />);
    fireEvent(screen.getByLabelText('Search input'), 'focus');
    expect(onFocusChange).toHaveBeenCalledWith(true);
  });

  it('shows close search control when focused without destination', () => {
    render(<SearchBar {...baseProps} />);
    fireEvent(screen.getByLabelText('Search input'), 'focus');
    expect(screen.getByLabelText('Close search')).toBeTruthy();
  });

  it('dismiss ref clears focus state', () => {
    const onFocusChange = jest.fn();
    const ref = createRef<SearchBarRef>();
    render(<SearchBar {...baseProps} ref={ref} onFocusChange={onFocusChange} />);
    fireEvent(screen.getByLabelText('Search input'), 'focus');
    expect(onFocusChange).toHaveBeenLastCalledWith(true);
    act(() => {
      ref.current?.dismiss();
    });
    expect(onFocusChange).toHaveBeenLastCalledWith(false);
  });

  it('close search button dismisses dropdown', () => {
    const onFocusChange = jest.fn();
    render(<SearchBar {...baseProps} onFocusChange={onFocusChange} />);
    fireEvent(screen.getByLabelText('Search input'), 'focus');
    fireEvent.press(screen.getByLabelText('Close search'));
    expect(onFocusChange).toHaveBeenLastCalledWith(false);
  });
});
