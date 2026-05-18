import React, { forwardRef, useImperativeHandle } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import {
  BayDetailSheet,
  buildBayDetailModel,
  verdictStatusColor,
  type BayDetailSheetRef,
} from '../BayDetailSheet';
import { colorBlindColors, colors } from '../../../design-system';
import {
  fetchBayCarbon,
  fetchBayEvaluation,
  type BayCarbon,
  type BayEvaluation,
} from '../../../services/apiBays';

const mockBottomSheetModal = jest.fn();

jest.mock('@gorhom/bottom-sheet', () => {
  const React = require('react');
  const { View } = require('react-native');

  return {
    BottomSheetModal: React.forwardRef(
      (
        props: {
          children: React.ReactNode;
          onChange?: (index: number) => void;
          onDismiss?: () => void;
        },
        ref: React.Ref<unknown>,
      ) => {
        mockBottomSheetModal(props);
        React.useImperativeHandle(ref, () => ({
          present: () => props.onChange?.(0),
          dismiss: () => props.onDismiss?.(),
          snapToIndex: (index: number) => props.onChange?.(index),
        }));
        return <View>{props.children}</View>;
      },
    ),
    BottomSheetScrollView: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
  };
});

jest.mock('../../../services/apiBays', () => ({
  fetchBayEvaluation: jest.fn(),
  fetchBayCarbon: jest.fn(),
}));

const evaluation: BayEvaluation = {
  verdict: 'yes',
  reason: 'Allowed under the active restriction.',
  active_restriction: {
    typedesc: '1P Ticket',
    rule_category: 'Timed parking',
    plain_english: 'You may park here for up to one hour.',
    max_stay_mins: 60,
    expires_at: '2026-05-18T10:00:00.000Z',
  },
  warning: { description: 'Check signs before leaving your car.' },
  data_source: 'db',
};
const carbon: BayCarbon = { saved_g: 120, pct_avoided: 0.4, score: 8 };

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

const Harness = forwardRef<
  BayDetailSheetRef,
  {
    onNavigateCta?: (bayId: string) => void;
    onWalkCta?: (bayId: string) => void;
    colorBlindMode?: boolean;
  }
>(({ onNavigateCta = jest.fn(), onWalkCta = jest.fn() }, ref) => (
  <BayDetailSheet ref={ref} onNavigateCta={onNavigateCta} onWalkCta={onWalkCta} />
));
Harness.displayName = 'BayDetailSheetHarness';

function renderSheet(props?: {
  onNavigateCta?: (bayId: string) => void;
  onWalkCta?: (bayId: string) => void;
}) {
  const ref = React.createRef<BayDetailSheetRef>();
  render(<Harness ref={ref} {...props} />);
  return ref;
}

async function present(ref: React.RefObject<BayDetailSheetRef | null>, bayId = '12345') {
  await act(async () => {
    ref.current?.present(bayId);
  });
}

describe('buildBayDetailModel', () => {
  test('builds chips, proof rows, and timeline support from evaluation data', () => {
    const model = buildBayDetailModel(evaluation, carbon);

    expect(model.chips.map((chip) => chip.label)).toEqual(
      expect.arrayContaining(['OK to park', '60 min max', 'Timed parking', 'Warning']),
    );
    expect(model.proofRows).toEqual(
      expect.arrayContaining([
        { label: 'Rule source', value: 'db' },
        { label: 'Matched rule', value: '1P Ticket' },
        { label: 'Carbon score', value: '8' },
      ]),
    );
    expect(model.hasTimeline).toBe(true);
  });

  test('returns an empty evidence model when evaluation data is missing', () => {
    const model = buildBayDetailModel(null, null);

    expect(model.restriction).toBeNull();
    expect(model.chips).toEqual([]);
    expect(model.proofRows).toEqual([]);
    expect(model.hasTimeline).toBe(false);
  });

  test('maps verdict colors through the color-blind palette', () => {
    expect(verdictStatusColor('yes', false)).toBe(colors.statusGood);
    expect(verdictStatusColor('yes', true)).toBe(colorBlindColors.statusGood);
    expect(verdictStatusColor('no', true)).toBe(colorBlindColors.statusAvoid);
    expect(verdictStatusColor('unknown', true)).toBe(colorBlindColors.statusUnknown);
  });
});

describe('BayDetailSheet component behavior', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (fetchBayEvaluation as jest.Mock).mockResolvedValue(evaluation);
    (fetchBayCarbon as jest.Mock).mockResolvedValue(carbon);
  });

  test('uses Phase 2 parity snap points', () => {
    renderSheet();

    expect(mockBottomSheetModal).toHaveBeenCalledWith(
      expect.objectContaining({ snapPoints: ['15%', '50%', '75%'] }),
    );
  });

  test('shows a loading state while evaluation data is in flight', async () => {
    const pendingEvaluation = deferred<BayEvaluation | null>();
    const pendingCarbon = deferred<BayCarbon | null>();
    (fetchBayEvaluation as jest.Mock).mockReturnValue(pendingEvaluation.promise);
    (fetchBayCarbon as jest.Mock).mockReturnValue(pendingCarbon.promise);

    const ref = renderSheet();
    await present(ref);

    expect(screen.UNSAFE_getByType(ActivityIndicator)).toBeTruthy();

    await act(async () => {
      pendingEvaluation.resolve(evaluation);
      pendingCarbon.resolve(carbon);
    });
  });

  test('renders successful evaluation details and timeline when expires_at is present', async () => {
    const ref = renderSheet();
    await present(ref);

    await waitFor(() => expect(screen.getAllByText('OK to park').length).toBeGreaterThan(0));
    expect(screen.getByText('Allowed under the active restriction.')).toBeTruthy();
    expect(screen.getByText('Parking limits')).toBeTruthy();
    expect(screen.getAllByText('1P Ticket').length).toBeGreaterThan(0);
    expect(screen.getByText('You may park here for up to one hour.')).toBeTruthy();
    expect(screen.getByText('Current window')).toBeTruthy();
    expect(screen.getByText('Active until')).toBeTruthy();
    expect(screen.getByText('Window ends')).toBeTruthy();
    expect(screen.getByText('Carbon savings')).toBeTruthy();
  });

  test('shows fallback notice when evaluation data is missing', async () => {
    (fetchBayEvaluation as jest.Mock).mockResolvedValue(null);
    (fetchBayCarbon as jest.Mock).mockResolvedValue(null);

    const ref = renderSheet();
    await present(ref);

    await waitFor(() =>
      expect(
        screen.getByText(
          'Rule and evaluation data is unavailable for this bay. You can still navigate to the bay location.',
        ),
      ).toBeTruthy(),
    );
  });

  test('Navigate CTA calls onNavigateCta with the current bay id', async () => {
    const onNavigateCta = jest.fn();
    const ref = renderSheet({ onNavigateCta });
    await present(ref, '67890');

    await waitFor(() => expect(screen.getByText('Navigate')).toBeTruthy());
    fireEvent.press(screen.getByText('Navigate'));

    expect(onNavigateCta).toHaveBeenCalledWith('67890');
  });

  test('Walk CTA calls onWalkCta with the current bay id', async () => {
    const onWalkCta = jest.fn();
    const ref = renderSheet({ onWalkCta });
    await present(ref, '24680');

    await waitFor(() => expect(screen.getByText('Walk')).toBeTruthy());
    fireEvent.press(screen.getByText('Walk'));

    expect(onWalkCta).toHaveBeenCalledWith('24680');
  });
});
