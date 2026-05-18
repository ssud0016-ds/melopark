/**
 * Basemap styles for the map tab.
 *
 * Avoid Mapbox Navigation Day/Night here: those styles paint traffic congestion
 * (green/amber/red roads) under our pressure MVT lines, so segments look
 * duplicated and "all over the place". Light/Dark are clean driving-friendly
 * underlays that match overlay contrast (closer to web CARTO Voyager intent).
 */
export const MAP_STYLE_DAY = 'mapbox://styles/mapbox/light-v11';
export const MAP_STYLE_NIGHT = 'mapbox://styles/mapbox/dark-v11';

/** @deprecated Use mapBasemapStyleUrl — kept for tests importing navigationMapStyleUrl */
export const MAP_STYLE_NAVIGATION_DAY = MAP_STYLE_DAY;
export const MAP_STYLE_NAVIGATION_NIGHT = MAP_STYLE_NIGHT;

export function mapBasemapStyleUrl(dark: boolean): string {
  return dark ? MAP_STYLE_NIGHT : MAP_STYLE_DAY;
}

/** @deprecated Alias for mapBasemapStyleUrl */
export function navigationMapStyleUrl(dark: boolean): string {
  return mapBasemapStyleUrl(dark);
}
