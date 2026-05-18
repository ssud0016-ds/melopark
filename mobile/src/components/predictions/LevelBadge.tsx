import { Text, View } from 'react-native';

import type { WarningLevel } from '../../services/apiForecasts';
import { useDarkMode } from '../../hooks/useDarkMode';
import { FORECAST_TIERS } from '../../utils/forecastUtils';

type Props = { level: WarningLevel; small?: boolean };

export function LevelBadge({ level, small }: Props) {
  const { dark } = useDarkMode();
  const t = FORECAST_TIERS[level] ?? FORECAST_TIERS.low;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: small ? 4 : 6,
        paddingHorizontal: small ? 8 : 10,
        paddingVertical: small ? 2 : 4,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: t.border,
        backgroundColor: dark ? t.bgDark : t.bg,
      }}
    >
      <View style={{ width: small ? 4 : 6, height: small ? 4 : 6, borderRadius: 99, backgroundColor: t.color }} />
      <Text style={{ fontSize: small ? 10 : 12, fontWeight: '700', color: dark ? t.color : t.text }}>
        {t.label}
      </Text>
    </View>
  );
}
