import {
  BAY_CLUSTER_MAX_ZOOM_LEVEL,
  BAY_INDIVIDUAL_MIN_ZOOM,
  MELBOURNE_MAX_BOUNDS,
  MELBOURNE_MAX_ZOOM,
  MELBOURNE_MIN_ZOOM,
} from '../mapGeo';

describe('bay cluster zoom constants', () => {
  it('unclusters at web cutoff zoom 18 (Mapbox max cluster zoom 17)', () => {
    expect(BAY_CLUSTER_MAX_ZOOM_LEVEL).toBe(BAY_INDIVIDUAL_MIN_ZOOM - 1);
    expect(BAY_INDIVIDUAL_MIN_ZOOM).toBe(18);
  });

  it('allows pinch to web max zoom 19', () => {
    expect(MELBOURNE_MAX_ZOOM).toBe(19);
  });

  it('restricts pan to padded Melbourne CBD (web MELBOURNE_MAX_BOUNDS)', () => {
    expect(MELBOURNE_MIN_ZOOM).toBe(13);
    expect(MELBOURNE_MAX_BOUNDS.ne[0]).toBeCloseTo(144.9945, 4);
    expect(MELBOURNE_MAX_BOUNDS.ne[1]).toBeCloseTo(-37.7855, 4);
    expect(MELBOURNE_MAX_BOUNDS.sw[0]).toBeCloseTo(144.9275, 4);
    expect(MELBOURNE_MAX_BOUNDS.sw[1]).toBeCloseTo(-37.8425, 4);
  });
});
