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

  test('permissions list is empty (Phase 3 adds)', () => {
    expect(appConfig.expo.android.permissions).toEqual([]);
  });
});
