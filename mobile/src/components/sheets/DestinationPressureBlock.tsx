import { Pressable, Text, View } from 'react-native';

import { AlternativeRow } from '../pressure/AlternativeRow';
import { PressureBar } from '../pressure/PressureBar';
import { colors } from '../../design-system';
import { useThemeColors } from '../../hooks/useThemeColors';
import type { AlternativesResponse, PressureAlternativeZone } from '../../types/pressureAlternatives';
import {
  chanceLabelForLevel,
  formatTargetZoneMetadata,
  isTargetZoneBusy,
  pickBetterAlternatives,
  targetZoneBarColor,
  targetZoneBarPct,
} from '../../utils/destinationPressure';

type Props = {
  isReady: boolean;
  data: AlternativesResponse | null;
  loading: boolean;
  error: string | null;
  colorBlindMode?: boolean;
  onRetry: () => void;
  selectedZoneId?: string | number | null;
  onAlternativePress?: (alt: PressureAlternativeZone) => void;
};

export function DestinationPressureBlock({
  isReady,
  data,
  loading,
  error,
  colorBlindMode = false,
  onRetry,
  selectedZoneId = null,
  onAlternativePress,
}: Props) {
  const theme = useThemeColors();

  if (!isReady) return null;

  if (loading) {
    return (
      <Text style={{ fontSize: 11, color: theme.textSecondary, marginBottom: 12 }}>
        Loading alternatives...
      </Text>
    );
  }

  if (error) {
    return (
      <View
        style={{
          marginBottom: 12,
          padding: 10,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: theme.statusAvoidBg,
          backgroundColor: theme.statusAvoidBg,
        }}
      >
        <Text style={{ fontSize: 10, color: colors.statusAvoid, marginBottom: 8 }}>
          Alternatives unavailable. Check connection and try again.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={onRetry}
          style={{
            alignSelf: 'flex-start',
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 6,
            borderWidth: 1,
            borderColor: theme.border,
            backgroundColor: theme.chrome,
          }}
        >
          <Text style={{ fontSize: 10, fontWeight: '600', color: colors.statusAvoid }}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  const zone = data?.target_zone;
  if (!zone) {
    return (
      <Text style={{ fontSize: 11, color: theme.textSecondary, marginBottom: 12 }}>
        Destination pressure unavailable for this area.
      </Text>
    );
  }

  const chance = chanceLabelForLevel(zone.level);
  const pct = targetZoneBarPct(zone);
  const barColor = targetZoneBarColor(zone.level, colorBlindMode);
  const busy = isTargetZoneBusy(zone.level);
  const better = busy ? pickBetterAlternatives(zone, data?.alternatives) : [];

  return (
    <View style={{ marginBottom: 12 }}>
      {data?.fallback_mode === 'segment_pressure' ? (
        <View
          style={{
            marginBottom: 8,
            padding: 8,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: theme.statusCautionBg,
            backgroundColor: theme.statusCautionBg,
          }}
        >
          <Text style={{ fontSize: 10, color: theme.textSecondary }}>
            Alternatives using live street model fallback.
          </Text>
        </View>
      ) : null}

      <Text
        style={{
          fontSize: 15,
          fontWeight: '700',
          color: theme.text,
          marginBottom: 4,
        }}
        accessibilityRole="header"
      >
        {chance}
      </Text>

      <Text style={{ fontSize: 11, color: theme.textSecondary, marginBottom: 2 }}>
        {formatTargetZoneMetadata(zone)}
      </Text>

      <PressureBar pct={pct} color={barColor} />

      {!busy ? (
        <Text
          style={{
            fontSize: 11,
            color: theme.liveChipText,
            marginTop: 10,
            lineHeight: 16,
          }}
        >
          Destination area looks okay. Alternatives appear when this area gets busy.
        </Text>
      ) : better.length > 0 ? (
        <View style={{ marginTop: 12 }}>
          <Text
            style={{
              fontSize: 10,
              fontWeight: '600',
              color: theme.textMuted,
              letterSpacing: 0.5,
              textTransform: 'uppercase',
              marginBottom: 8,
            }}
          >
            Better nearby options
          </Text>
          {better.map((alt, i) => (
            <AlternativeRow
              key={`zone-${alt.zone_id}-${i}`}
              alt={alt}
              selected={selectedZoneId != null && String(selectedZoneId) === String(alt.zone_id)}
              colorBlindMode={colorBlindMode}
              onPress={onAlternativePress}
            />
          ))}
        </View>
      ) : (
        <Text
          style={{
            fontSize: 11,
            color: theme.textSecondary,
            marginTop: 10,
            lineHeight: 16,
          }}
        >
          No better parking options within 800 m.
        </Text>
      )}
    </View>
  );
}
