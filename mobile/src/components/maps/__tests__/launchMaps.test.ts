import * as Linking from 'expo-linking';

import { launchMaps } from '../launchMaps';

jest.mock('expo-linking', () => ({
  canOpenURL: jest.fn(),
  openURL: jest.fn(),
}));

const BAY = { lat: -37.8136, lng: 144.9631 };
const DEST = { lat: -37.81, lng: 144.97 };

describe('launchMaps', () => {
  beforeEach(() => jest.clearAllMocks());

  test('google provider tries google.navigation: first for drive', async () => {
    (Linking.canOpenURL as jest.Mock).mockResolvedValue(true);
    (Linking.openURL as jest.Mock).mockResolvedValue(undefined);
    const ok = await launchMaps({ provider: 'google', destination: BAY });
    expect(ok).toBe(true);
    expect((Linking.openURL as jest.Mock).mock.calls[0][0]).toMatch(/^google\.navigation:/);
  });

  test('walk mode uses bay as origin and destination as end', async () => {
    (Linking.canOpenURL as jest.Mock).mockResolvedValue(true);
    (Linking.openURL as jest.Mock).mockResolvedValue(undefined);
    await launchMaps({
      provider: 'web',
      mode: 'walk',
      origin: BAY,
      destination: DEST,
    });
    const url = (Linking.openURL as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain('travelmode=walking');
    expect(url).toContain(`origin=${BAY.lat},${BAY.lng}`);
    expect(url).toContain(`destination=${DEST.lat},${DEST.lng}`);
  });

  test('waze provider tries waze:// first', async () => {
    (Linking.canOpenURL as jest.Mock).mockResolvedValue(true);
    (Linking.openURL as jest.Mock).mockResolvedValue(undefined);
    const ok = await launchMaps({ provider: 'waze', destination: BAY });
    expect(ok).toBe(true);
    expect((Linking.openURL as jest.Mock).mock.calls[0][0]).toMatch(/^waze:\/\//);
  });

  test('falls through to web when native not supported and calls onFallback', async () => {
    const onFallback = jest.fn();
    (Linking.canOpenURL as jest.Mock)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    (Linking.openURL as jest.Mock).mockResolvedValue(undefined);
    const ok = await launchMaps({ provider: 'google', destination: BAY, onFallback });
    expect(ok).toBe(true);
    expect((Linking.openURL as jest.Mock).mock.calls[0][0]).toMatch(/^https:\/\/www\.google\.com/);
    expect(onFallback).toHaveBeenCalledWith({ provider: 'google' });
  });

  test('returns false when nothing opens', async () => {
    (Linking.canOpenURL as jest.Mock).mockResolvedValue(false);
    const ok = await launchMaps({ provider: 'google', destination: { lat: 1, lng: 2 } });
    expect(ok).toBe(false);
    expect(Linking.openURL).not.toHaveBeenCalled();
  });
});
