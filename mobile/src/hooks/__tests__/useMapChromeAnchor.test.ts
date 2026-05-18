import {
  chromeTranslateYFromSheetTop,
  chromeTranslateYWithoutSheet,
  MAP_CHROME_PILL_HEIGHT,
  MAP_CHROME_SHEET_GAP,
} from '../useMapChromeAnchor';

describe('map chrome anchor math', () => {
  it('places pills above sheet top with gap', () => {
    expect(chromeTranslateYFromSheetTop(680)).toBe(680 - MAP_CHROME_PILL_HEIGHT - MAP_CHROME_SHEET_GAP);
  });

  it('falls back above tab bar when sheet hidden', () => {
    expect(chromeTranslateYWithoutSheet(800, 90)).toBe(
      800 - 90 - MAP_CHROME_PILL_HEIGHT - MAP_CHROME_SHEET_GAP,
    );
  });
});
