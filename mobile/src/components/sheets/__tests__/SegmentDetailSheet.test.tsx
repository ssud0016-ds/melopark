import { act, createRef } from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';

import { SegmentDetailSheet, type SegmentDetailSheetRef } from '../SegmentDetailSheet';

jest.mock('@gorhom/bottom-sheet', () => {
  const React = require('react');
  const { View } = require('react-native');
  const BottomSheetModal = React.forwardRef(
    ({ children }: { children: React.ReactNode }, ref: React.Ref<unknown>) => {
      React.useImperativeHandle(ref, () => ({
        present: jest.fn(),
        dismiss: jest.fn(),
      }));
      return <View testID="segment-sheet">{children}</View>;
    },
  );
  BottomSheetModal.displayName = 'BottomSheetModal';
  const BottomSheetView = ({ children }: { children: React.ReactNode }) => <View>{children}</View>;
  return { __esModule: true, BottomSheetModal, BottomSheetView };
});

const mockFetchSegmentDetail = jest.fn();
jest.mock('../../../services/apiPressure', () => ({
  fetchSegmentDetail: (...args: unknown[]) => mockFetchSegmentDetail(...args),
}));

const apiDetail = {
  street_name: 'Test St',
  level: 'low',
  trend: 'up',
  pressure: 0.2,
  total: 10,
  free: 7,
  has_live_bays: true,
  occ_pct: 30,
  events: [],
};

describe('SegmentDetailSheet trend display', () => {
  beforeEach(() => {
    mockFetchSegmentDetail.mockReset();
    mockFetchSegmentDetail.mockResolvedValue(apiDetail);
  });

  test('shows rising trend with aria label when segment loads', async () => {
    const ref = createRef<SegmentDetailSheetRef>();
    render(<SegmentDetailSheet ref={ref} manifest={{ tile_url_template: '/tiles' }} />);

    await act(async () => {
      ref.current?.present('seg-1');
    });

    await waitFor(() => {
      expect(screen.getByText(/Good parking chance/)).toBeTruthy();
    });
    expect(screen.getByText(/30% taken/)).toBeTruthy();
    expect(screen.getByText(/↑ rising/)).toBeTruthy();
    expect(screen.getByLabelText('rising')).toBeTruthy();
    expect(screen.getByText(/Why:/)).toBeTruthy();
    expect(mockFetchSegmentDetail).toHaveBeenCalledWith('seg-1', { dataVersion: null });
  });

  test('shows falling trend aria when trend is down', async () => {
    mockFetchSegmentDetail.mockResolvedValue({ ...apiDetail, trend: 'down', level: 'medium', occ_pct: 55 });
    const ref = createRef<SegmentDetailSheetRef>();
    render(<SegmentDetailSheet ref={ref} />);

    await act(async () => {
      ref.current?.present('seg-2');
    });

    await waitFor(() => {
      expect(screen.getByLabelText('falling')).toBeTruthy();
    });
    expect(screen.getByText(/↓ falling/)).toBeTruthy();
  });

  test('shows Why line for high-pressure segment with events (web parity)', async () => {
    mockFetchSegmentDetail.mockResolvedValue({
      street_name: 'Test St',
      level: 'high',
      trend: 'up',
      pressure: 0.77,
      total: 10,
      free: 3,
      has_live_bays: true,
      occ_pct: 70,
      events: [
        { name: 'Big Game', distance_m: 100, start_iso: '2026-05-02T18:00:00' },
        { name: 'Concert Hall Show', distance_m: 200, start_iso: '2026-05-02T19:00:00' },
      ],
    });
    const ref = createRef<SegmentDetailSheetRef>();
    render(<SegmentDetailSheet ref={ref} />);

    await act(async () => {
      ref.current?.present('seg-high');
    });

    await waitFor(() => {
      expect(screen.getByText(/Hard to park/)).toBeTruthy();
    });
    expect(
      screen.getByText('Why: Bays filling up · Traffic rising · Event nearby'),
    ).toBeTruthy();
    expect(screen.getByLabelText('Bays filling up · Traffic rising · Event nearby')).toBeTruthy();
    expect(screen.getByText('Big Game')).toBeTruthy();
    expect(screen.getByText('Concert Hall Show')).toBeTruthy();
  });

  test('shows +1 when API returns three events', async () => {
    mockFetchSegmentDetail.mockResolvedValue({
      street_name: 'Test St',
      level: 'high',
      trend: 'up',
      pressure: 0.77,
      total: 10,
      free: 3,
      has_live_bays: true,
      occ_pct: 70,
      events: [
        { name: 'Big Game', distance_m: 100, start_iso: '2026-05-02T18:00:00' },
        { name: 'Concert Hall Show', distance_m: 200, start_iso: '2026-05-02T19:00:00' },
        { name: 'Third Event', distance_m: 300, start_iso: '2026-05-02T20:00:00' },
      ],
    });
    const ref = createRef<SegmentDetailSheetRef>();
    render(<SegmentDetailSheet ref={ref} />);

    await act(async () => {
      ref.current?.present('seg-three-events');
    });

    await waitFor(() => {
      expect(screen.getByText('+1')).toBeTruthy();
    });
    expect(screen.queryByText('Third Event')).toBeNull();
  });

  test('does not show event badges when API returns no events', async () => {
    mockFetchSegmentDetail.mockResolvedValue({
      ...apiDetail,
      events: [],
    });
    const ref = createRef<SegmentDetailSheetRef>();
    render(<SegmentDetailSheet ref={ref} />);

    await act(async () => {
      ref.current?.present('seg-no-events');
    });

    await waitFor(() => {
      expect(screen.getByText(/Good parking chance/)).toBeTruthy();
    });
    expect(screen.queryByText('Big Game')).toBeNull();
    expect(screen.queryByText('+1')).toBeNull();
  });

  test('shows steady trend aria when trend is flat', async () => {
    mockFetchSegmentDetail.mockResolvedValue({ ...apiDetail, trend: 'flat', occ_pct: 20 });
    const ref = createRef<SegmentDetailSheetRef>();
    render(<SegmentDetailSheet ref={ref} />);

    await act(async () => {
      ref.current?.present('seg-3');
    });

    await waitFor(() => {
      expect(screen.getByLabelText('steady')).toBeTruthy();
    });
    expect(screen.getByText(/· steady/)).toBeTruthy();
  });
});
