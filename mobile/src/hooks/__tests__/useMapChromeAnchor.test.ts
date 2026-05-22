import {
  chromeHintTranslateYFromSheetTop,
  chromeHintTranslateYWithoutSheet,
  chromeTranslateYFromSheetTop,
  chromeTranslateYWithoutSheet,
  legendBottomFromSheetTop,
  legendBottomWithoutSheet,
  MAP_CHROME_PILL_HEIGHT,
  MAP_CHROME_SHEET_GAP,
  MAP_LEGEND_SHEET_CLEARANCE,
  MAP_ZOOM_HINT_GAP,
  MAP_ZOOM_HINT_HEIGHT,
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

  it('places zoom hint above scope strip row', () => {
    expect(chromeHintTranslateYFromSheetTop(680)).toBe(
      680 - MAP_CHROME_PILL_HEIGHT - MAP_CHROME_SHEET_GAP - MAP_ZOOM_HINT_GAP - MAP_ZOOM_HINT_HEIGHT,
    );
    expect(chromeHintTranslateYWithoutSheet(800, 90)).toBe(
      800 - 90 - MAP_CHROME_PILL_HEIGHT - MAP_CHROME_SHEET_GAP - MAP_ZOOM_HINT_GAP - MAP_ZOOM_HINT_HEIGHT,
    );
  });

  it('pins legend bottom above sheet top with web mobile clearance', () => {
    expect(legendBottomFromSheetTop(800, 680)).toBe(800 - 680 + MAP_LEGEND_SHEET_CLEARANCE);
    expect(legendBottomFromSheetTop(800, 680, 60)).toBe(180);
  });

  it('pins legend bottom above tab bar when sheet hidden', () => {
    expect(legendBottomWithoutSheet(90)).toBe(90 + MAP_LEGEND_SHEET_CLEARANCE);
    expect(legendBottomWithoutSheet(90, 60)).toBe(150);
  });
});
