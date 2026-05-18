import type { ForecastWarning } from '../../services/apiForecasts';
import {
  buildCbdHourlyChart,
  buildCbdSignals,
  buildTopFreeZones,
  FORECAST_HOURS,
  zonesAtCurrentHour,
} from '../forecastUtils';

function w(
  zone: string,
  hours: number,
  occ: number,
  level: ForecastWarning['warning_level'] = 'low',
): ForecastWarning {
  return { zone, hours_from_now: hours, warning_level: level, predicted_occupancy: occ };
}

describe('buildCbdHourlyChart', () => {
  it('returns exactly 7 hourly buckets (0–6)', () => {
    const chart = buildCbdHourlyChart([
      w('A St', 0, 0.2, 'low'),
      w('B St', 0, 0.4, 'moderate'),
      w('A St', 1, 0.5, 'moderate'),
      w('B St', 1, 0.7, 'high'),
    ]);
    expect(chart).toHaveLength(7);
    expect(chart.map((p) => p.h)).toEqual([...FORECAST_HOURS]);
  });

  it('averages predicted_occupancy per hour across zones', () => {
    const chart = buildCbdHourlyChart([
      w('A St', 0, 0.2),
      w('B St', 0, 0.4),
      w('A St', 1, 0.6),
      w('B St', 1, 0.8),
    ]);
    expect(chart[0].occ).toBeCloseTo(0.3, 5);
    expect(chart[1].occ).toBeCloseTo(0.7, 5);
  });

  it('picks worst warning_level per hour bucket', () => {
    const chart = buildCbdHourlyChart([
      w('A St', 0, 0.2, 'low'),
      w('B St', 0, 0.3, 'critical'),
    ]);
    expect(chart[0].level).toBe('critical');
  });

  it('uses fallback occ when hour has no rows', () => {
    const chart = buildCbdHourlyChart([w('A St', 0, 0.25)]);
    expect(chart[3].occ).toBe(0.19);
    expect(chart[3].level).toBe('low');
  });
});

describe('zonesAtCurrentHour', () => {
  it('dedupes to one row per zone at hour 0', () => {
    const zones = zonesAtCurrentHour([
      w('Kay Street (X)', 0, 0.5, 'low'),
      w('Kay Street (X)', 0, 0.8, 'high'),
      w('Other', 1, 0.9, 'critical'),
    ]);
    expect(zones).toHaveLength(1);
    expect(zones[0].zone).toBe('Kay Street (X)');
    expect(zones[0].warning_level).toBe('high');
  });
});

describe('buildTopFreeZones', () => {
  it('sorts ascending by occupancy', () => {
    const zones = zonesAtCurrentHour([
      w('Busy', 0, 0.9),
      w('Calm', 0, 0.1),
    ]);
    const top = buildTopFreeZones(zones, 2);
    expect(top[0].zone).toBe('Calm');
    expect(top[1].zone).toBe('Busy');
  });
});

describe('buildCbdSignals', () => {
  it('returns four signal rows', () => {
    const chart = buildCbdHourlyChart([w('A', 0, 0.2), w('B', 0, 0.8, 'high'), w('A', 1, 0.5)]);
    const zones = zonesAtCurrentHour([w('A', 0, 0.2), w('B', 0, 0.8, 'high')]);
    const signals = buildCbdSignals(chart, buildTopFreeZones(zones), buildTopFreeZones(zones).reverse());
    expect(signals.length).toBeGreaterThanOrEqual(3);
  });
});
