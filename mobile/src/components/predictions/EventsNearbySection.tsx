import { Text, View } from 'react-native';

import { colors } from '../../design-system';
import type { ForecastWarning } from '../../services/apiForecasts';
import { useThemeColors } from '../../hooks/useThemeColors';
import { splitZone } from '../../utils/forecastUtils';

type Props = { warnings: ForecastWarning[] };

export function EventsNearbySection({ warnings }: Props) {
  const theme = useThemeColors();

  const events = (() => {
    const seen = new Set<string>();
    const out: ForecastWarning[] = [];
    for (const w of warnings) {
      if (w.hours_from_now > 2) continue;
      const ev = w.events_nearby;
      if (!ev || ev === 'None') continue;
      const risky =
        w.event_risk_level === 'high' ||
        w.event_risk_level === 'critical' ||
        (ev && ev !== 'None');
      if (!risky) continue;
      if (seen.has(ev)) continue;
      seen.add(ev);
      out.push(w);
    }
    return out;
  })();

  if (!events.length) return null;

  return (
    <View
      style={{
        gap: 8,
        padding: 16,
        borderRadius: 16,
        backgroundColor: theme.statusCautionBg,
        borderWidth: 1,
        borderColor: colors.statusCaution,
      }}
    >
      <Text style={{ fontSize: 11, fontWeight: '700', color: theme.tabActive, letterSpacing: 1 }}>
        ACTIVE EVENTS NEARBY
      </Text>
      {events.map((w, i) => {
        const [main] = splitZone(w.zone);
        return (
          <View key={`event-${w.events_nearby ?? i}-${w.hours_from_now}`} style={{ gap: 2 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: theme.text }}>{w.events_nearby}</Text>
            <Text style={{ fontSize: 12, color: theme.textSecondary }}>
              Near {main} · +{w.hours_from_now}h · {w.event_risk_level ?? 'event'} risk
            </Text>
          </View>
        );
      })}
    </View>
  );
}
