import { Pressable, Text, View } from 'react-native';

import { AlternativeRow } from '../pressure/AlternativeRow';
import { PressureBar } from '../pressure/PressureBar';
import { colors } from '../../design-system';
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
  if (!isReady) return null;

  if (loading) {
    return (
      <Text style={{ fontSize: 11, color: colors.surfaceDarkTertiary, marginBottom: 12 }}>
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
          borderColor: '#fecaca',
          backgroundColor: '#fff1f2',
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
            borderColor: '#fca5a5',
            backgroundColor: colors.surface,
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
      <Text style={{ fontSize: 11, color: colors.surfaceDarkTertiary, marginBottom: 12 }}>
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
            borderColor: '#fde68a',
            backgroundColor: '#fffbeb',
          }}
        >
          <Text style={{ fontSize: 10, color: '#92400e' }}>
            Alternatives using live street model fallback.
          </Text>
        </View>
      ) : null}

      <Text
        style={{
          fontSize: 15,
          fontWeight: '700',
          color: colors.surfaceDark,
          marginBottom: 4,
        }}
        accessibilityRole="header"
      >
        {chance}
      </Text>

      <Text style={{ fontSize: 11, color: colors.surfaceDarkTertiary, marginBottom: 2 }}>
        {formatTargetZoneMetadata(zone)}
      </Text>

      <PressureBar pct={pct} color={barColor} />

      {!busy ? (
        <Text
          style={{
            fontSize: 11,
            color: colors.statusGood,
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
              color: colors.surfaceDarkTertiary,
              letterSpacing: 0.5,
              textTransform: 'uppercase',
              marginBottom: 8,
            }}
          >
            Better nearby options
          </Text>
          {better.map((alt) => (
            <AlternativeRow
              key={String(alt.zone_id)}
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
            color: colors.surfaceDarkTertiary,
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
