import { isMapZoomHintVisible } from '../MapZoomHint';
import { BAY_INDIVIDUAL_MIN_ZOOM } from '../../../utils/mapGeo';

describe('isMapZoomHintVisible', () => {
  const base = {
    mapZoom: BAY_INDIVIDUAL_MIN_ZOOM - 1,
    onboardingActive: false,
    baySheetFull: false,
  };

  it('shows below individual bay zoom threshold', () => {
    expect(isMapZoomHintVisible(base)).toBe(true);
  });

  it('hides at or above individual bay zoom', () => {
    expect(isMapZoomHintVisible({ ...base, mapZoom: BAY_INDIVIDUAL_MIN_ZOOM })).toBe(false);
    expect(isMapZoomHintVisible({ ...base, mapZoom: BAY_INDIVIDUAL_MIN_ZOOM + 1 })).toBe(false);
  });

  it('hides during onboarding or full bay sheet', () => {
    expect(isMapZoomHintVisible({ ...base, onboardingActive: true })).toBe(false);
    expect(isMapZoomHintVisible({ ...base, baySheetFull: true })).toBe(false);
  });
});
