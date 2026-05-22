import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { colors, fontFamily } from '../../design-system';
import {
  getStatusFillColor,
  PRESSURE_UNKNOWN_COLOR,
  PRESSURE_UNKNOWN_COLOR_BLIND,
} from '../../utils/pressureSegmentStyle';

type Props = {
  colorBlindMode: boolean;
  parkingChanceActive?: boolean;
};

const ACCESSIBLE_BLUE = '#60a5fa';

export function MapLegend({ colorBlindMode, parkingChanceActive = false }: Props) {
  const [open, setOpen] = useState(false);
  const [coachOpen, setCoachOpen] = useState(false);

  const availableColor = getStatusFillColor('available', colorBlindMode);
  const cautionColor = getStatusFillColor('caution', colorBlindMode);
  const occupiedColor = getStatusFillColor('occupied', colorBlindMode);
  const unknownColor = colorBlindMode ? PRESSURE_UNKNOWN_COLOR_BLIND : PRESSURE_UNKNOWN_COLOR;

  const bayRows = [
    { color: availableColor, label: 'Available parking spots' },
    { color: cautionColor, label: 'Caution: Tow Away / Loading Zone' },
    { color: occupiedColor, label: 'Parking spots occupied' },
  ];

  const streetRows = [
    { color: availableColor, label: 'Good chance street' },
    { color: cautionColor, label: 'Getting busy street' },
    { color: occupiedColor, label: 'Hard to park street' },
    { color: unknownColor, label: 'No live estimate' },
  ];

  return (
    <View
      pointerEvents="box-none"
      style={{
        maxWidth: 320,
        alignSelf: 'flex-end',
      }}
    >
      <View
        style={{
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.brand,
          backgroundColor: colors.brand,
          overflow: 'visible',
          shadowColor: '#000',
          shadowOpacity: 0.2,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 2 },
          elevation: 6,
        }}
      >
        {!open ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Show legend"
            onPress={() => setOpen(true)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: 10,
              paddingVertical: 6,
            }}
          >
            {[availableColor, cautionColor, occupiedColor].map((c) => (
              <View
                key={c}
                style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c }}
              />
            ))}
            <Text
              style={{
                marginLeft: 2,
                fontSize: 10,
                fontFamily: fontFamily.sansSemiBold,
                fontWeight: '600',
                letterSpacing: 1,
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.85)',
              }}
            >
              Legend
            </Text>
          </Pressable>
        ) : (
          <View style={{ paddingHorizontal: 10, paddingTop: 10, paddingBottom: 12, maxWidth: 320 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text
                style={{
                  fontSize: 10,
                  fontFamily: fontFamily.sansSemiBold,
                  fontWeight: '600',
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                  color: 'rgba(255,255,255,0.8)',
                }}
              >
                Verified bays
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Hide legend"
                onPress={() => setOpen(false)}
                hitSlop={8}
              >
                <Text style={{ fontSize: 18, lineHeight: 18, color: 'rgba(255,255,255,0.8)' }}>×</Text>
              </Pressable>
            </View>
            {bayRows.map(({ color, label }) => (
              <LegendDotRow key={label} color={color} label={label} />
            ))}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <Svg width={14} height={14} viewBox="0 0 24 24">
                <Circle cx="12" cy="12" r="12" fill={ACCESSIBLE_BLUE} />
                <Path
                  fill="#fff"
                  d="M12 2c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2m9 7h-6v13h-2v-6h-2v6H9V9H3V7h18v2z"
                />
              </Svg>
              <Text style={legendLabelStyle}>Accessible bays</Text>
            </View>
            <Text
              style={{
                fontSize: 10,
                fontFamily: fontFamily.sansSemiBold,
                fontWeight: '600',
                letterSpacing: 1,
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.8)',
                marginTop: 8,
                marginBottom: 4,
              }}
            >
              Street parking chance
            </Text>
            {streetRows.map(({ color, label }) => (
              <LegendLineRow key={label} color={color} label={label} />
            ))}
            {parkingChanceActive ? (
              <View
                style={{
                  marginTop: 8,
                  borderTopWidth: 1,
                  borderTopColor: 'rgba(255,255,255,0.2)',
                  paddingTop: 8,
                  paddingBottom: 2,
                }}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="About street parking chance"
                  onPress={() => setCoachOpen((v) => !v)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 2 }}
                >
                  <View
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: 7,
                      borderWidth: 1,
                      borderColor: 'rgba(255,255,255,0.4)',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 9, fontWeight: '700', color: 'rgba(255,255,255,0.7)' }}>?</Text>
                  </View>
                  <Text
                    style={{
                      fontSize: 10,
                      lineHeight: 15,
                      color: 'rgba(255,255,255,0.7)',
                    }}
                  >
                    About parking chance
                  </Text>
                </Pressable>
                {coachOpen ? (
                  <View
                    style={{
                      marginTop: 6,
                      borderRadius: 8,
                      backgroundColor: 'rgba(255,255,255,0.1)',
                      paddingHorizontal: 8,
                      paddingTop: 8,
                      paddingBottom: 10,
                      overflow: 'visible',
                    }}
                  >
                    <Text style={coachBodyStyle}>
                      Green streets are easier to find parking. Tap any coloured street to see live data.
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Dismiss parking chance tip"
                      onPress={() => setCoachOpen(false)}
                      hitSlop={4}
                      style={{ alignSelf: 'flex-start', marginTop: 4 }}
                    >
                      <Text style={coachDismissStyle}>Got it</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
        )}
      </View>
    </View>
  );
}

const legendLabelStyle = {
  flex: 1,
  fontSize: 11,
  color: 'rgba(255,255,255,0.95)',
} as const;

const coachBodyStyle = {
  fontSize: 10,
  lineHeight: 16,
  color: 'rgba(255,255,255,0.9)',
} as const;

const coachDismissStyle = {
  fontSize: 10,
  lineHeight: 16,
  fontFamily: fontFamily.sansSemiBold,
  fontWeight: '700',
  textDecorationLine: 'underline',
  color: 'rgba(255,255,255,0.9)',
} as const;

function LegendDotRow({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
      <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: color }} />
      <Text style={legendLabelStyle} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

function LegendLineRow({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
      <View style={{ width: 20, height: 6, borderRadius: 3, backgroundColor: color }} />
      <Text style={legendLabelStyle} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}
