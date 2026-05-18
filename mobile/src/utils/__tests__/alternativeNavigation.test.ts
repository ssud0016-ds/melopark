import { frameMapToAlternative } from '../alternativeNavigation';
import { QUIET_STREET_FLY_MS, QUIET_STREET_MAP_ZOOM } from '../mapGeo';

describe('frameMapToAlternative', () => {
  test('fitBounds both destination and alt when destination set', () => {
    const fitBounds = jest.fn();
    const flyTo = jest.fn();
    const dest = { lat: -37.8136, lng: 144.9631 };
    const alt = { lat: -37.8123, lng: 144.9612 };

    frameMapToAlternative({ fitBounds, flyTo }, dest, alt);

    expect(fitBounds).toHaveBeenCalledWith([dest, alt], {
      paddingPx: 80,
      maxZoom: QUIET_STREET_MAP_ZOOM,
      durationMs: QUIET_STREET_FLY_MS,
    });
    expect(flyTo).not.toHaveBeenCalled();
  });

  test('flyTo alt only when no destination', () => {
    const fitBounds = jest.fn();
    const flyTo = jest.fn();
    const alt = { lat: -37.8123, lng: 144.9612 };

    frameMapToAlternative({ fitBounds, flyTo }, null, alt);

    expect(flyTo).toHaveBeenCalledWith(alt.lat, alt.lng, {
      zoom: QUIET_STREET_MAP_ZOOM,
      durationMs: QUIET_STREET_FLY_MS,
    });
    expect(fitBounds).not.toHaveBeenCalled();
  });

  test('no-op when map ref missing', () => {
    expect(() =>
      frameMapToAlternative(null, { lat: -37.81, lng: 144.96 }, { lat: -37.812, lng: 144.961 }),
    ).not.toThrow();
  });
});
