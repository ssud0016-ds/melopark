import * as Linking from 'expo-linking';

import { launchMaps } from '../launchMaps';

jest.mock('expo-linking', () => ({
  canOpenURL: jest.fn(),
  openURL: jest.fn(),
}));

describe('launchMaps', () => {
  beforeEach(() => jest.clearAllMocks());

  test('google provider tries google.navigation: first', async () => {
    (Linking.canOpenURL as jest.Mock).mockResolvedValue(true);
    (Linking.openURL as jest.Mock).mockResolvedValue(undefined);
    const ok = await launchMaps({ provider: 'google', lat: -37.81, lng: 144.96 });
    expect(ok).toBe(true);
    expect((Linking.openURL as jest.Mock).mock.calls[0][0]).toMatch(/^google\.navigation:/);
  });

  test('falls through to web when native not supported', async () => {
    (Linking.canOpenURL as jest.Mock)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    (Linking.openURL as jest.Mock).mockResolvedValue(undefined);
    const ok = await launchMaps({ provider: 'google', lat: -37.81, lng: 144.96 });
    expect(ok).toBe(true);
    expect((Linking.openURL as jest.Mock).mock.calls[0][0]).toMatch(/^https:\/\/www\.google\.com/);
  });

  test('web provider opens browser fallback directly', async () => {
    (Linking.canOpenURL as jest.Mock).mockResolvedValue(true);
    (Linking.openURL as jest.Mock).mockResolvedValue(undefined);
    const ok = await launchMaps({ provider: 'web', lat: -37.81, lng: 144.96 });
    expect(ok).toBe(true);
    expect((Linking.openURL as jest.Mock).mock.calls[0][0]).toMatch(/^https:\/\/www\.google\.com/);
  });

  test('walking mode is passed to Google Maps URLs', async () => {
    (Linking.canOpenURL as jest.Mock).mockResolvedValue(true);
    (Linking.openURL as jest.Mock).mockResolvedValue(undefined);
    const ok = await launchMaps({
      provider: 'google',
      lat: -37.81,
      lng: 144.96,
      travelMode: 'walking',
    });
    expect(ok).toBe(true);
    expect((Linking.openURL as jest.Mock).mock.calls[0][0]).toContain('&mode=w');
  });

  test('returns false when nothing opens', async () => {
    (Linking.canOpenURL as jest.Mock).mockResolvedValue(false);
    const ok = await launchMaps({ provider: 'google', lat: 1, lng: 2 });
    expect(ok).toBe(false);
    expect(Linking.openURL).not.toHaveBeenCalled();
  });
});
