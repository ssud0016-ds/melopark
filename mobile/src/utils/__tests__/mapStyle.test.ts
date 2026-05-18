import {
  MAP_STYLE_DAY,
  MAP_STYLE_NIGHT,
  mapBasemapStyleUrl,
  navigationMapStyleUrl,
} from '../mapStyle';

describe('mapStyle', () => {
  test('mapBasemapStyleUrl switches light and dark', () => {
    expect(mapBasemapStyleUrl(false)).toBe(MAP_STYLE_DAY);
    expect(mapBasemapStyleUrl(true)).toBe(MAP_STYLE_NIGHT);
  });

  test('uses light/dark mapbox styles (not navigation traffic layers)', () => {
    expect(MAP_STYLE_DAY).toContain('light-v11');
    expect(MAP_STYLE_NIGHT).toContain('dark-v11');
    expect(MAP_STYLE_DAY).not.toContain('navigation');
  });

  test('navigationMapStyleUrl aliases mapBasemapStyleUrl', () => {
    expect(navigationMapStyleUrl(false)).toBe(mapBasemapStyleUrl(false));
  });
});
