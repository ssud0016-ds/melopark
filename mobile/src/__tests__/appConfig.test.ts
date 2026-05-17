// §7.14 — app.config.js platform constants.
import appConfig from '../../app.config.js';

describe('app.config.js', () => {
  test('platforms: android only', () => {
    expect(appConfig.expo.platforms).toEqual(['android']);
  });

  test('minSdkVersion = 26', () => {
    expect(appConfig.expo.android.minSdkVersion).toBe(26);
  });

  test('package = app.melopark', () => {
    expect(appConfig.expo.android.package).toBe('app.melopark');
  });

  test('scheme = melopark', () => {
    expect(appConfig.expo.scheme).toBe('melopark');
  });

  test('edge-to-edge status bar translucent', () => {
    expect(appConfig.expo.androidStatusBar.translucent).toBe(true);
  });

  // Phase 3 review gate: permissions exactly [FINE, COARSE]. No notifications, no extras.
  test('permissions list is exactly [FINE, COARSE]', () => {
    expect(appConfig.expo.android.permissions).toEqual([
      'ACCESS_FINE_LOCATION',
      'ACCESS_COARSE_LOCATION',
    ]);
  });

  test('App Links autoVerify on melopark.app', () => {
    const filters = appConfig.expo.android.intentFilters ?? [];
    const appLink = filters.find((f) =>
      f.data?.some?.((d) => d.host === 'melopark.app'),
    );
    expect(appLink?.autoVerify).toBe(true);
  });

  test('melopark:// scheme intent filter present', () => {
    const filters = appConfig.expo.android.intentFilters ?? [];
    const schemeFilter = filters.find((f) =>
      f.data?.some?.((d) => d.scheme === 'melopark'),
    );
    expect(schemeFilter).toBeDefined();
  });
});
