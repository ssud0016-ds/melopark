import { Text, View } from 'react-native';

import { useThemeColors } from '../../hooks/useThemeColors';
import type { Bay, BayEvaluation } from '../../services/apiBays';
import { formatLeaveByClock } from '../../utils/plannerTime';

type Props = {
  bay: Bay | null;
  evaluation: BayEvaluation | null;
};

const INK = '#2E2A8A';

export function BayStatusAndLimits({ bay, evaluation }: Props) {
  const theme = useThemeColors();
  const restriction = evaluation?.active_restriction ?? null;
  const warning = evaluation?.warning ?? null;

  const maxStay = restriction?.max_stay_mins ?? null;
  const leaveBy = formatLeaveByClock(restriction?.expires_at) || formatLeaveByClock(warning?.starts_at) || null;

  const nowText =
    bay?.free === 1
      ? 'Sensor reports this space is free'
      : bay?.free === 0
        ? 'Sensor reports this space is occupied'
        : 'No live sensor data for this bay';

  const items = [
    { title: 'Now', desc: nowText, highlight: false },
    ...(maxStay != null
      ? [{ title: 'Maximum Stay', desc: `Maximum stay is ${maxStay} minutes`, highlight: true }]
      : []),
    ...(leaveBy ? [{ title: 'Leave By', desc: leaveBy, highlight: false }] : []),
  ];

  return (
    <View style={{ paddingHorizontal: 20, marginTop: 20 }}>
      <Text style={{ fontSize: 14, fontWeight: '600', color: theme.text, marginBottom: 12 }}>
        Bay Status and Limits
      </Text>

      <View>
        {items.map((t, i) => (
          <View key={t.title} style={{ flexDirection: 'row', alignItems: 'stretch' }}>
            <View style={{ marginRight: 16, width: 12, alignItems: 'center' }}>
              <View
                style={{
                  marginTop: 2,
                  width: 12,
                  height: 12,
                  borderRadius: 6,
                  backgroundColor: t.highlight ? INK : 'transparent',
                  borderWidth: t.highlight ? 0 : 2,
                  borderColor: theme.chromeMuted,
                }}
              />
              {i < items.length - 1 ? (
                <View style={{ width: 2, flex: 1, minHeight: 12, backgroundColor: theme.chromeMuted, marginTop: 4 }} />
              ) : null}
            </View>
            <View style={{ flex: 1, paddingBottom: i < items.length - 1 ? 20 : 0 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: theme.text }}>{t.title}</Text>
              <Text style={{ marginTop: 2, fontSize: 11, lineHeight: 17, color: theme.textSecondary }}>
                {t.desc}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
