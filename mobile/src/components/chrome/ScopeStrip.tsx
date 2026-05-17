import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, zIndex } from '../../design-system';
import { useFilters } from '../../hooks/useFilters';

type Props = {
  onOpenFilters: () => void;
  bottomOffset?: number;
};

export function ScopeStrip({ onOpenFilters, bottomOffset = 0 }: Props) {
  const insets = useSafeAreaInsets();
  const { isDefault, modifiedPills } = useFilters();
  const visiblePills = modifiedPills.slice(0, 2);
  const overflow = Math.max(0, modifiedPills.length - 2);

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 14,
        right: 14,
        bottom: insets.bottom + 56 + bottomOffset + 12,
        zIndex: zIndex.scopeStrip,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
      }}
    >
      {isDefault ? (
        <Chip tone="good">Live now</Chip>
      ) : (
        <>
          {visiblePills.map((p) => (
            <Chip key={p} tone="brand">
              {p}
            </Chip>
          ))}
          {overflow > 0 ? <Chip tone="brand">{`+${overflow}`}</Chip> : null}
        </>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open filters"
        onPress={onOpenFilters}
        style={{
          minHeight: 44,
          paddingHorizontal: 12,
          borderRadius: 999,
          backgroundColor: colors.surface,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#000',
          shadowOpacity: 0.08,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 2 },
          elevation: 3,
        }}
      >
        <Text style={{ fontSize: 12, fontWeight: '600', color: colors.brand }}>Filters ▾</Text>
      </Pressable>
    </View>
  );
}

function Chip({ children, tone }: { children: React.ReactNode; tone: 'good' | 'brand' }) {
  const bg = tone === 'good' ? colors.statusGoodBg : colors.surfaceTertiary;
  const fg = tone === 'good' ? colors.statusGood : colors.brand;
  return (
    <View
      style={{
        minHeight: 44,
        paddingHorizontal: 12,
        borderRadius: 999,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontSize: 12, fontWeight: '600', color: fg }}>{children}</Text>
    </View>
  );
}
