import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React, { createRef } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { HelpModal, type HelpModalRef } from '../HelpModal';

const safeAreaMetrics = {
  insets: { top: 0, left: 0, right: 0, bottom: 34 },
  frame: { x: 0, y: 0, width: 390, height: 844 },
};

function renderHelp(ui: React.ReactElement) {
  return render(<SafeAreaProvider initialMetrics={safeAreaMetrics}>{ui}</SafeAreaProvider>);
}

jest.mock('@gorhom/bottom-sheet', () => {
  const React = require('react');
  const { View } = require('react-native');
  const BottomSheetModal = React.forwardRef(
    ({ children }: { children: React.ReactNode }, ref: unknown) => {
      React.useImperativeHandle(ref, () => ({
        present: jest.fn(),
        dismiss: jest.fn(),
      }));
      return <View>{children}</View>;
    },
  );
  return {
    BottomSheetModal,
    BottomSheetScrollView: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
  };
});

jest.mock('../../../hooks/useThemeColors', () => ({
  useThemeColors: () => ({
    sheet: '#ffffff',
    chrome: '#f4f6ff',
    chromeMuted: '#f4f6ff',
    border: 'rgba(226,232,240,0.6)',
    text: '#111827',
    textSecondary: '#6b7280',
    textMuted: '#9ca3af',
    tabActive: '#35338c',
    brandOnBrand: '#ffffff',
    handle: '#374151',
  }),
}));

describe('HelpModal', () => {
  it('renders all tab labels', () => {
    renderHelp(<HelpModal />);
    expect(screen.getByText('Map')).toBeTruthy();
    expect(screen.getByText('Parking Pressure')).toBeTruthy();
    expect(screen.getByText('Filters')).toBeTruthy();
    expect(screen.getByText('Bay Details')).toBeTruthy();
  });

  it('shows map tab section by default', () => {
    renderHelp(<HelpModal />);
    expect(screen.getByText('Bay colours')).toBeTruthy();
    expect(screen.getByText('Green: available')).toBeTruthy();
  });

  it('switches to pressure tab content', () => {
    renderHelp(<HelpModal />);
    fireEvent.press(screen.getByText('Parking Pressure'));
    expect(screen.getByText('Street colours')).toBeTruthy();
    expect(screen.getByText('Alternative Zones')).toBeTruthy();
  });

  it('shows future planner copy on filters tab', () => {
    renderHelp(<HelpModal />);
    fireEvent.press(screen.getByText('Filters'));
    expect(screen.getByText('Arrival time planner')).toBeTruthy();
    expect(
      screen.getByText(
        'When you set an arrival time, map bay colors reflect parking rules at that planned time (not live occupancy).',
      ),
    ).toBeTruthy();
  });

  it('shows future-time notice on bay tab', () => {
    renderHelp(<HelpModal />);
    fireEvent.press(screen.getByText('Bay Details'));
    expect(screen.getByText('Future-time notice')).toBeTruthy();
    expect(
      screen.getByText(
        'Amber notice: live occupancy is unknown for future times; rules are evaluated for your scheduled arrival.',
      ),
    ).toBeTruthy();
  });

  it('shows verdict descriptions without duplicating badge labels', () => {
    renderHelp(<HelpModal />);
    fireEvent.press(screen.getByText('Bay Details'));
    expect(screen.getByText('Yes to Park')).toBeTruthy();
    expect(screen.getByText('Safe to park for your selected time')).toBeTruthy();
    expect(screen.getAllByText('Yes to Park')).toHaveLength(1);
  });

  it('calls onReplayOnboarding when footer pressed', () => {
    const onReplayOnboarding = jest.fn();
    renderHelp(<HelpModal onReplayOnboarding={onReplayOnboarding} />);
    fireEvent.press(screen.getByLabelText('Replay onboarding tutorial'));
    expect(onReplayOnboarding).toHaveBeenCalledTimes(1);
  });

  it('resets to map tab on present', () => {
    const ref = createRef<HelpModalRef>();
    renderHelp(<HelpModal ref={ref} />);
    fireEvent.press(screen.getByText('Filters'));
    expect(screen.getByText('Map at planned time')).toBeTruthy();
    act(() => {
      ref.current?.present();
    });
    expect(screen.getByText('Bay colours')).toBeTruthy();
  });
});
