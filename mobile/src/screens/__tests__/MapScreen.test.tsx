import { act, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { MapScreen } from '../MapScreen';
import { resolveBayDeepLinkRequest } from '../mapDeepLink';
import { useBays } from '../../hooks/useBays';
import { fetchEvaluateBulk, type Bay } from '../../services/apiBays';

const mockNavigate = jest.fn();
const mockSetOptions = jest.fn();
const mockParkingMap = jest.fn();
const mockBusyNowLayer = jest.fn();
let mockBayDetailSheetProps:
  | { colorBlindMode?: boolean; onSheetIndexChange?: (index: number) => void }
  | undefined;
let mockRouteParams: Record<string, unknown> | undefined;
let mockColorBlindMode = false;

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    getParent: () => ({ setOptions: mockSetOptions }),
  }),
  useRoute: () => ({ params: mockRouteParams }),
}));

jest.mock('../../hooks/useBays', () => ({
  useBays: jest.fn(),
}));

jest.mock('../../hooks/useBusyNow', () => ({
  useBusyNow: () => ({ manifest: { tile_url_template: '/tiles/{z}/{x}/{y}.mvt' } }),
}));

jest.mock('../../hooks/useColorBlindMode', () => ({
  useColorBlindMode: () => ({ enabled: mockColorBlindMode }),
}));

jest.mock('../../hooks/useLocationPermission', () => ({
  useLocationPermission: () => ({
    state: 'granted',
    canAskAgain: false,
    request: jest.fn(),
  }),
}));

jest.mock('../../hooks/useMapsProvider', () => ({
  useMapsProvider: () => ({ provider: 'google' }),
}));

jest.mock('../../hooks/useOnboarding', () => ({
  useOnboarding: () => ({ needsOnboarding: false, complete: jest.fn() }),
}));

jest.mock('../../components/common/Toast', () => ({
  useToast: () => ({ show: jest.fn() }),
}));

jest.mock('../../components/maps/launchMaps', () => ({
  launchMaps: jest.fn(),
}));

jest.mock('../../components/maps/ParkingMap', () => ({
  ParkingMap: (props: { children?: React.ReactNode }) => {
    const { View } = require('react-native');
    mockParkingMap(props);
    return <View testID="parking-map">{props.children}</View>;
  },
}));

jest.mock('../../components/maps/BusyNowLayer', () => ({
  BusyNowLayer: (props: unknown) => {
    mockBusyNowLayer(props);
    return null;
  },
}));

jest.mock('../../components/onboarding/OnboardingOverlay', () => ({
  OnboardingOverlay: () => null,
}));

jest.mock('../../components/sheets/BayDetailSheet', () => {
  const React = require('react');
  return {
    SNAP_FULL_INDEX: 2,
    BayDetailSheet: React.forwardRef(
      (
        props: { colorBlindMode?: boolean; onSheetIndexChange?: (index: number) => void },
        ref: React.Ref<unknown>,
      ) => {
        mockBayDetailSheetProps = props;
      React.useImperativeHandle(ref, () => ({
        present: jest.fn(),
        dismiss: jest.fn(),
        snapTo: jest.fn(),
        getIndex: () => -1,
      }));
      return null;
      },
    ),
  };
});

jest.mock('../../components/sheets/SegmentDetailSheet', () => {
  const React = require('react');
  return {
    SegmentDetailSheet: React.forwardRef((_props: unknown, ref: React.Ref<unknown>) => {
      React.useImperativeHandle(ref, () => ({
        present: jest.fn(),
      }));
      return null;
    }),
  };
});

jest.mock('../../services/apiBays', () => ({
  fetchEvaluateBulk: jest.fn(),
}));

const bay = (id: string, name: string, lat: number, lng: number): Bay => ({
  id,
  name,
  lat,
  lng,
  type: 'available',
  spots: 1,
  free: 1,
  bayType: 'Metered',
  durationMins: 60,
  hasRules: true,
  allowDetail: true,
  sensorLastUpdated: null,
  source: 'live',
});

const bays = [
  bay('1001', 'Queen Street', -37.81, 144.96),
  bay('1002', 'Queen Street', -37.812, 144.962),
  bay('2001', 'King Street', -37.82, 144.95),
];

function mockBays({ loading = false }: { loading?: boolean } = {}) {
  (useBays as jest.Mock).mockReturnValue({
    bays,
    loading,
    error: null,
    availableBayCount: 3,
  });
}

function renderScreen() {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}
    >
      <MapScreen />
    </SafeAreaProvider>,
  );
}

function lastParkingMapProps() {
  return mockParkingMap.mock.calls[mockParkingMap.mock.calls.length - 1][0];
}

describe('resolveBayDeepLinkRequest', () => {
  test('waits for initial bay data before resolving a requested bay', () => {
    expect(resolveBayDeepLinkRequest('12345', [], true)).toBe('waiting');
  });

  test('finds a requested bay once it is present in the bay list', () => {
    expect(resolveBayDeepLinkRequest('12345', [{ id: '12345' }], false)).toBe('found');
  });

  test('reports a requested bay as not found after data has loaded without it', () => {
    expect(resolveBayDeepLinkRequest('missing', [{ id: '12345' }], false)).toBe('not-found');
  });
});

describe('MapScreen planning behavior', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBayDetailSheetProps = undefined;
    mockRouteParams = undefined;
    mockColorBlindMode = false;
    mockBays();
    (fetchEvaluateBulk as jest.Mock).mockResolvedValue([
      { bay_id: '1001', verdict: 'yes' },
      { bay_id: '2001', verdict: 'no' },
    ]);
  });

  test('without planning params preserves live parking map behavior', () => {
    renderScreen();

    expect(fetchEvaluateBulk).not.toHaveBeenCalled();
    expect(screen.getByText('Melbourne CBD')).toBeTruthy();
    expect(screen.getByText('3 available - 3 total')).toBeTruthy();

    const props = lastParkingMapProps();
    expect(props.destination).toBeNull();
    expect(props.initialCenter).toBeUndefined();
    expect(props.initialZoom).toBeUndefined();
    expect(props.highlightedBayIds).toEqual([]);
    expect(props.planningVerdicts).toEqual({});
    expect(props.colorBlindMode).toBe(false);
  });

  test('passes color-blind mode into map and BusyNow layers', () => {
    mockColorBlindMode = true;

    renderScreen();

    expect(lastParkingMapProps().colorBlindMode).toBe(true);
    expect(mockBusyNowLayer).toHaveBeenCalledWith(
      expect.objectContaining({ colorBlindMode: true }),
    );
    expect(mockBayDetailSheetProps?.colorBlindMode).toBe(true);
  });

  test('planning destination params set planning state and pass destination props to ParkingMap', async () => {
    mockRouteParams = {
      planningMode: 'destination',
      destinationLat: -37.811,
      destinationLng: 144.961,
      destinationLabel: 'Queen Street',
    };

    renderScreen();

    expect(screen.getByText('Planning destination')).toBeTruthy();
    expect(screen.getByText('Queen Street - 3 nearby bays highlighted')).toBeTruthy();

    const props = lastParkingMapProps();
    expect(props.destination).toEqual({
      lat: -37.811,
      lng: 144.961,
      label: 'Queen Street',
    });
    expect(props.initialCenter).toEqual([144.961, -37.811]);
    expect(props.initialZoom).toBe(15);
    expect(props.highlightedBayIds).toEqual(expect.arrayContaining(['1001', '1002', '2001']));
    expect(props.highlightedBayIds).toHaveLength(3);

    await waitFor(() =>
      expect(lastParkingMapProps().planningVerdicts).toEqual({
        '1001': 'yes',
        '2001': 'no',
      }),
    );
  });

  test('planning destination triggers fetchEvaluateBulk with a destination bbox', async () => {
    mockRouteParams = {
      planningMode: 'destination',
      destinationLat: -37.811,
      destinationLng: 144.961,
      destinationLabel: 'Queen Street',
    };

    renderScreen();

    await waitFor(() => expect(fetchEvaluateBulk).toHaveBeenCalledTimes(1));
    expect(fetchEvaluateBulk).toHaveBeenCalledWith(
      expect.stringMatching(/^144\.955,-37\.817,144\.967,-37\.805/),
      expect.objectContaining({ durationMins: 60, arrivalIso: expect.any(String) }),
    );
  });

  test('bulk verdicts are passed to ParkingMap as planning verdict overrides and highlighted ids', async () => {
    mockRouteParams = {
      planningMode: 'destination',
      destinationLat: -37.811,
      destinationLng: 144.961,
      destinationLabel: 'Queen Street',
    };

    renderScreen();

    await waitFor(() =>
      expect(lastParkingMapProps().planningVerdicts).toEqual({
        '1001': 'yes',
        '2001': 'no',
      }),
    );
    expect(lastParkingMapProps().highlightedBayIds).toEqual(
      expect.arrayContaining(['1001', '1002', '2001']),
    );
    expect(lastParkingMapProps().highlightedBayIds).toHaveLength(3);
  });

  test('hides the tab bar only when the bay sheet reaches full snap point', () => {
    renderScreen();

    act(() => {
      mockBayDetailSheetProps?.onSheetIndexChange?.(0);
    });
    expect(mockSetOptions).toHaveBeenLastCalledWith({
      tabBarStyle: expect.objectContaining({ height: 56 }),
    });

    act(() => {
      mockBayDetailSheetProps?.onSheetIndexChange?.(1);
    });
    expect(mockSetOptions).toHaveBeenLastCalledWith({
      tabBarStyle: expect.objectContaining({ height: 56 }),
    });

    act(() => {
      mockBayDetailSheetProps?.onSheetIndexChange?.(2);
    });
    expect(mockSetOptions).toHaveBeenLastCalledWith({
      tabBarStyle: { display: 'none' },
    });
  });
});
