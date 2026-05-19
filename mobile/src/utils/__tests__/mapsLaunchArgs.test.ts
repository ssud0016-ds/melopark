import { buildMapsLaunchArgs } from '../mapsLaunchArgs';

const BAY = { lat: -37.8136, lng: 144.9631, id: 1, name: 'Test Bay' };
const DEST = { lat: -37.81, lng: 144.97 };

describe('buildMapsLaunchArgs', () => {
  test('drive mode uses bay as destination', () => {
    const args = buildMapsLaunchArgs('google', 'drive', BAY, null);
    expect(args.mode).toBe('drive');
    expect(args.destination).toEqual({ lat: BAY.lat, lng: BAY.lng });
    expect(args.origin).toBeUndefined();
  });

  test('walk mode uses bay as origin and landmark as destination', () => {
    const args = buildMapsLaunchArgs('google', 'walk', BAY, DEST);
    expect(args.mode).toBe('walk');
    expect(args.origin).toEqual({ lat: BAY.lat, lng: BAY.lng });
    expect(args.destination).toEqual(DEST);
  });
});
