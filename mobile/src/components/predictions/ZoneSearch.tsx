import { useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { PREDICTIONS_SEARCH_COPY } from '../../content/searchCopy';
import { colors, haptics } from '../../design-system';
import type { ForecastWarning } from '../../services/apiForecasts';
import { useDarkMode } from '../../hooks/useDarkMode';
import { useThemeColors } from '../../hooks/useThemeColors';
import { PREDICTIONS_BRAND, PREDICTIONS_SEARCH_GLASS } from './predictionsTheme';
import { FORECAST_TIERS, occupancyPct, splitZone, zonesAtCurrentHour } from '../../utils/forecastUtils';
import { LevelBadge } from './LevelBadge';

type Props = {
  warnings: ForecastWarning[];
  value: string;
  onChangeQuery: (q: string) => void;
  onPick: (zone: ForecastWarning) => void;
  variant?: 'default' | 'header';
};

export function ZoneSearch({ warnings, value, onChangeQuery, onPick, variant = 'default' }: Props) {
  const theme = useThemeColors();
  const { dark } = useDarkMode();
  const header = variant === 'header';
  const [open, setOpen] = useState(false);
  const zones = useMemo(() => zonesAtCurrentHour(warnings), [warnings]);

  const results = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return [];
    return zones
      .filter((z) => z.zone.toLowerCase().includes(q))
      .sort((a, b) => a.zone.toLowerCase().indexOf(q) - b.zone.toLowerCase().indexOf(q))
      .slice(0, 10);
  }, [value, zones]);

  const dropdownBg = dark ? '#1e293b' : '#ffffff';
  const dropdownBorder = dark ? '#334155' : '#d5d8ef';

  return (
    <View style={{ zIndex: 20 }}>
      <TextInput
        accessibilityLabel="Search parking zones"
        placeholder={PREDICTIONS_SEARCH_COPY.placeholder}
        placeholderTextColor={header ? 'rgba(255,255,255,0.45)' : theme.textSecondary}
        value={value}
        onChangeText={(t) => {
          onChangeQuery(t);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        style={{
          minHeight: header ? 48 : 44,
          borderRadius: 12,
          paddingHorizontal: header ? 16 : 14,
          paddingVertical: header ? 12 : 10,
          backgroundColor: header ? PREDICTIONS_SEARCH_GLASS.backgroundColor : theme.chrome,
          borderWidth: header ? 1.5 : 1,
          borderColor: header ? PREDICTIONS_SEARCH_GLASS.borderColor : theme.border,
          color: header ? '#fff' : theme.text,
          fontSize: 14,
        }}
      />
      {open && results.length > 0 ? (
        <View
          style={{
            marginTop: 6,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: dropdownBorder,
            backgroundColor: dropdownBg,
            overflow: 'hidden',
            maxHeight: 360,
          }}
        >
          <View
            style={{
              paddingHorizontal: 16,
              paddingVertical: 6,
              borderBottomWidth: 1,
              borderBottomColor: dark ? '#334155' : '#e2e8f0',
              backgroundColor: dark ? '#0f172a' : '#F2F4FD',
            }}
          >
            <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 0.5, color: PREDICTIONS_BRAND }}>
              {results.length} STREETS FOUND
            </Text>
          </View>
          {results.map((z) => {
            const [main, cross] = splitZone(z.zone);
            const pct = occupancyPct(z);
            const t = FORECAST_TIERS[z.warning_level];
            return (
              <Pressable
                key={z.zone}
                accessibilityRole="button"
                onPress={() => {
                  haptics.selection();
                  onPick(z);
                  onChangeQuery(z.zone);
                  setOpen(false);
                }}
                style={{
                  minHeight: 48,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: dark ? '#1e293b' : '#f1f3fc',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: dark ? t.bgDark : t.bg,
                    borderWidth: 1,
                    borderColor: t.border,
                  }}
                >
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.color }} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{ fontSize: 14, fontWeight: '600', color: dark ? '#e2e8f0' : '#1e293b' }}
                    numberOfLines={1}
                  >
                    {main}
                  </Text>
                  {cross ? (
                    <Text style={{ fontSize: 12, color: dark ? '#94a3b8' : '#94a3b8' }} numberOfLines={1}>
                      {cross}
                    </Text>
                  ) : null}
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: t.color }}>{pct}%</Text>
                  <Text style={{ fontSize: 9, color: dark ? '#64748b' : '#94a3b8' }}>occupied</Text>
                </View>
                <LevelBadge level={z.warning_level} small />
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}
