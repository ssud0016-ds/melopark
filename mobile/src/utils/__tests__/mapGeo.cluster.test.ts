import {
  BAY_CLUSTER_MAX_ZOOM_LEVEL,
  BAY_INDIVIDUAL_MIN_ZOOM,
  MELBOURNE_MAX_ZOOM,
} from '../mapGeo';

describe('bay cluster zoom constants', () => {
  it('unclusters at web cutoff zoom 18 (Mapbox max cluster zoom 17)', () => {
    expect(BAY_CLUSTER_MAX_ZOOM_LEVEL).toBe(BAY_INDIVIDUAL_MIN_ZOOM - 1);
    expect(BAY_INDIVIDUAL_MIN_ZOOM).toBe(18);
  });

  it('allows pinch to web max zoom 19', () => {
    expect(MELBOURNE_MAX_ZOOM).toBe(19);
  });
});
