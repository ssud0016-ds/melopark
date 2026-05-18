import {
  buildReasons,
  formatChanceLine,
  formatWhyLine,
  SEGMENT_CHANCE_TEXT,
  TREND_ARIA,
  TREND_LABEL,
} from '../segmentPopup';
import type { SegmentPopupDetail } from '../segmentDetailFromApi';

const baseDetail: SegmentPopupDetail = {
  street_name: 'Test St',
  level: 'high',
  trend: 'up',
  pressure: 0.77,
  total_bays: 10,
  free_bays: 3,
  has_live_bays: true,
  occ_pct: 70,
  events_nearby: [{ event_name: 'Big Game' }],
};

describe('segmentPopup', () => {
  test('TREND_LABEL and TREND_ARIA match web', () => {
    expect(TREND_LABEL.up).toBe('↑ rising');
    expect(TREND_LABEL.down).toBe('↓ falling');
    expect(TREND_LABEL.flat).toBe('· steady');
    expect(TREND_ARIA.up).toBe('rising');
    expect(TREND_ARIA.down).toBe('falling');
    expect(TREND_ARIA.flat).toBe('steady');
  });

  test('formatChanceLine includes trend for rising', () => {
    const line = formatChanceLine(baseDetail);
    expect(line.chanceText).toBe(SEGMENT_CHANCE_TEXT.high);
    expect(line.occSuffix).toBe(' · 70% taken');
    expect(line.trendLabel).toBe('↑ rising');
    expect(line.trendAria).toBe('rising');
  });

  test('formatChanceLine uses falling aria when trend is down', () => {
    const line = formatChanceLine({ ...baseDetail, trend: 'down' });
    expect(line.trendLabel).toBe('↓ falling');
    expect(line.trendAria).toBe('falling');
  });

  test('formatChanceLine uses steady aria when trend is flat', () => {
    const line = formatChanceLine({ ...baseDetail, trend: 'flat' });
    expect(line.trendLabel).toBe('· steady');
    expect(line.trendAria).toBe('steady');
  });

  test('buildReasons includes Traffic rising when trend is up', () => {
    const reasons = buildReasons(baseDetail);
    expect(reasons).toContain('Bays filling up');
    expect(reasons).toContain('Traffic rising');
    expect(reasons).toContain('Event nearby');
  });

  test('buildReasons uses Most bays taken when occ_pct >= 80', () => {
    const reasons = buildReasons({ ...baseDetail, occ_pct: 85 });
    expect(reasons).toContain('Most bays taken');
    expect(reasons).not.toContain('Bays filling up');
  });

  test('formatWhyLine matches web high-pressure join', () => {
    expect(formatWhyLine(baseDetail)).toBe(
      'Why: Bays filling up · Traffic rising · Event nearby',
    );
  });

  test('critical level maps to Hard to park', () => {
    const line = formatChanceLine({ ...baseDetail, level: 'critical' });
    expect(line.chanceText).toBe(SEGMENT_CHANCE_TEXT.critical);
  });
});
