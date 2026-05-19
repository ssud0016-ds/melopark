import { render, screen, waitFor } from '@testing-library/react-native';
import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { View } from 'react-native';

import { BayDetailSheet, type BayDetailSheetRef } from '../BayDetailSheet';
import type { Bay, BayEvaluation } from '../../../services/apiBays';

const mockFetchBayEvaluation = jest.fn();
const mockFetchBayCarbon = jest.fn();

jest.mock('../../../services/apiBays', () => ({
  fetchBayEvaluation: (...args: unknown[]) => mockFetchBayEvaluation(...args),
  fetchBayCarbon: (...args: unknown[]) => mockFetchBayCarbon(...args),
}));

jest.mock('../../../hooks/useMapsProvider', () => ({
  useMapsProvider: () => ({ provider: 'google', setProvider: jest.fn(), clearProvider: jest.fn() }),
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
}));

jest.mock('@gorhom/bottom-sheet', () => {
  const React = require('react');
  const { View: RNView } = require('react-native');
  const BottomSheetModal = React.forwardRef(
    ({ children }: { children: React.ReactNode }, ref: unknown) => {
      React.useImperativeHandle(ref, () => ({
        present: jest.fn(),
        dismiss: jest.fn(),
        snapToIndex: jest.fn(),
      }));
      return <RNView>{children}</RNView>;
    },
  );
  return {
    BottomSheetModal,
    BottomSheetScrollView: ({ children }: { children: React.ReactNode }) => <RNView>{children}</RNView>,
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
    tabInactive: '#9ca3af',
    statusGoodBg: '#f0fdf4',
    statusCautionBg: '#fffbeb',
    statusAvoidBg: '#fef2f2',
    liveChipBg: '#f0fdf4',
    liveChipText: '#15803d',
    handle: '#374151',
    brand: '#35338c',
    brandOnBrand: '#ffffff',
  }),
}));

jest.mock('../../../hooks/useDarkMode', () => ({
  useDarkMode: () => ({ dark: false, toggle: jest.fn(), setTheme: jest.fn() }),
}));

const OCCUPIED_BAY: Bay = {
  id: '1000',
  type: 'occupied',
  bayType: 'Other',
  hasRules: true,
  free: 0,
  name: 'Queen Street',
  lat: -37.81,
  lng: 144.96,
  spots: 1,
  durationMins: null,
  allowDetail: true,
  sensorLastUpdated: null,
  source: 'live',
};

type SheetProps = React.ComponentProps<typeof BayDetailSheet>;

const SheetHost = forwardRef<BayDetailSheetRef, SheetProps>(function SheetHost(props, ref) {
  const innerRef = useRef<BayDetailSheetRef>(null);
  useImperativeHandle(ref, () => innerRef.current as BayDetailSheetRef);
  useEffect(() => {
    innerRef.current?.present(OCCUPIED_BAY);
  }, []);
  return <BayDetailSheet ref={innerRef} {...props} />;
});

function renderSheet(overrides: Partial<SheetProps> = {}) {
  return render(
    <SheetHost
      destination={null}
      durationFilter="1h"
      customDuration={60}
      plannerArrivalIso={null}
      plannerDurationMins={60}
      accessibleRulesByBayId={{}}
      {...overrides}
    />,
  );
}

const yesEvaluation: BayEvaluation = {
  verdict: 'yes',
  reason: 'Rules allow parking at selected time.',
  active_restriction: null,
  warning: null,
  data_source: 'db',
};

const noEvaluation: BayEvaluation = {
  verdict: 'no',
  reason: 'Restriction active at selected time.',
  active_restriction: null,
  warning: null,
  data_source: 'db',
};

describe('BayDetailSheet future planning', () => {
  beforeEach(() => {
    mockFetchBayEvaluation.mockReset();
    mockFetchBayCarbon.mockReset();
    mockFetchBayCarbon.mockResolvedValue({ saved_g: 0, pct_avoided: 0, score: 0 });
  });

  it('shows future disclaimer and YES when occupied bay allows parking at planned time', async () => {
    const futureIso = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    mockFetchBayEvaluation.mockResolvedValue(yesEvaluation);

    renderSheet({ plannerArrivalIso: futureIso, plannerDurationMins: 120 });

    expect(
      await screen.findByText(
        'Live bay availability is unknown for this future time. Parking rules shown are based on the scheduled time only.',
      ),
    ).toBeTruthy();
    expect(await screen.findByText('YES')).toBeTruthy();
    expect(screen.getByText('OCCUPIED NOW')).toBeTruthy();
    expect(mockFetchBayEvaluation).toHaveBeenCalledWith('1000', {
      arrivalIso: futureIso,
      durationMins: 120,
    });
  });

  it('shows NO for future time when rules block parking', async () => {
    const futureIso = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    mockFetchBayEvaluation.mockResolvedValue(noEvaluation);

    renderSheet({ plannerArrivalIso: futureIso, plannerDurationMins: 120 });

    expect(await screen.findByText('NO')).toBeTruthy();
    expect(screen.getByText('You cannot park here')).toBeTruthy();
  });

  it('forces NO in live mode when bay is occupied even if API says yes', async () => {
    mockFetchBayEvaluation.mockResolvedValue(yesEvaluation);

    renderSheet({ plannerArrivalIso: null });

    await waitFor(() => expect(mockFetchBayEvaluation).toHaveBeenCalled());
    expect(await screen.findByText('NO')).toBeTruthy();
    expect(
      screen.queryByText(
        'Live bay availability is unknown for this future time. Parking rules shown are based on the scheduled time only.',
      ),
    ).toBeNull();
  });
});
