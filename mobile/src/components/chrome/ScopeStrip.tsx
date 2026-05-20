import { Pressable, Text, View } from 'react-native';

import { useFilters } from '../../hooks/useFilters';
import { useThemeColors } from '../../hooks/useThemeColors';
import { formatProximityChipLabel } from '../../utils/proximityBays';

type Props = {
  onOpenFilters: () => void;
  proxFreeBays?: number;
  proxFreeSpots?: number;
};

/** Live / filter pills — position via parent anchored to parking chance sheet top. */
export function ScopeStrip({ onOpenFilters, proxFreeBays = 0, proxFreeSpots = 0 }: Props) {
  const theme = useThemeColors();
  const { isDefault, modifiedPills } = useFilters();
  const visiblePills = modifiedPills.slice(0, 2);
  const overflow = Math.max(0, modifiedPills.length - 2);
  const showProximity = proxFreeBays > 0;

  return (
    <View
      pointerEvents="box-none"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flexShrink: 1,
      }}
    >
      {showProximity ? (
        <Chip tone="good" theme={theme} shrink>
          {formatProximityChipLabel({ proxFreeBays, proxFreeSpots })}
        </Chip>
      ) : isDefault ? (
        <Chip tone="good" theme={theme}>
          Live now
        </Chip>
      ) : null}
      {!isDefault ? (
        <>
          {visiblePills.map((p) => (
            <Chip key={p} tone="brand" theme={theme}>
              {p}
            </Chip>
          ))}
          {overflow > 0 ? (
            <Chip tone="brand" theme={theme}>{`+${overflow}`}</Chip>
          ) : null}
        </>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open filters"
        onPress={onOpenFilters}
        style={{
          minHeight: 44,
          paddingHorizontal: 12,
          borderRadius: 999,
          backgroundColor: theme.chrome,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#000',
          shadowOpacity: 0.08,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 2 },
          elevation: 3,
        }}
      >
        <Text style={{ fontSize: 12, fontWeight: '600', color: theme.tabActive }}>Filters ▾</Text>
      </Pressable>
    </View>
  );
}

function Chip({
  children,
  tone,
  theme,
  shrink = false,
}: {
  children: React.ReactNode;
  tone: 'good' | 'brand';
  theme: ReturnType<typeof useThemeColors>;
  shrink?: boolean;
}) {
  const bg = tone === 'good' ? theme.liveChipBg : theme.chromeMuted;
  const fg = tone === 'good' ? theme.liveChipText : theme.tabActive;
  return (
    <View
      style={{
        minHeight: 44,
        maxWidth: shrink ? '46%' : undefined,
        flexShrink: shrink ? 1 : 0,
        paddingHorizontal: 12,
        borderRadius: 999,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{ fontSize: 12, fontWeight: '600', color: fg }}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {children}
      </Text>
    </View>
  );
}
