import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useThemeColors } from '../../hooks/useThemeColors';
import type { PressureManifest } from '../../services/apiPressure';

type Props = {
  manifest: PressureManifest;
};

/** Seconds since manifest.generated_at (web BusyNowPanel SourcePills). */
export function manifestAgeSec(generatedAt: string | undefined, nowMs = Date.now()): number {
  if (!generatedAt) return 0;
  const t = new Date(generatedAt).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.round((nowMs - t) / 1000));
}

function SourcePills({ manifest }: { manifest: PressureManifest }) {
  const theme = useThemeColors();
  const [ageSec, setAgeSec] = useState(() => manifestAgeSec(manifest.generated_at));
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!manifest.generated_at) return;
    const tick = () => setAgeSec(manifestAgeSec(manifest.generated_at));
    tick();
    intervalRef.current = setInterval(tick, 10_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [manifest.generated_at]);

  const activeCount = manifest.events?.active_count ?? 0;
  const pills = [
    { key: 'sensors', label: `Live bays · ${ageSec}s ago` },
    { key: 'traffic_profile', label: 'SCATS · historical' },
    { key: 'events', label: `Events · ${activeCount} active` },
  ];

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
      {pills.map((p) => (
        <View
          key={p.key}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            borderRadius: 999,
            paddingHorizontal: 6,
            paddingVertical: 2,
            backgroundColor: theme.chromeMuted,
          }}
        >
          <View
            style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: '#10b981' }}
            accessibilityElementsHidden
          />
          <Text style={{ fontSize: 9, fontWeight: '500', color: theme.textSecondary }}>{p.label}</Text>
        </View>
      ))}
    </View>
  );
}

/** Collapsible data sources footer — parity with web BusyNowPanel. */
export function DataSourcesSection({ manifest }: Props) {
  const [open, setOpen] = useState(false);
  const theme = useThemeColors();

  return (
    <View
      style={{
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: theme.border,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Data sources"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((v) => !v)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
      >
        <View
          style={{
            width: 14,
            height: 14,
            borderRadius: 7,
            borderWidth: 1,
            borderColor: theme.textMuted,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 9, fontWeight: '700', color: theme.textMuted }}>i</Text>
        </View>
        <Text style={{ fontSize: 10, fontWeight: '500', color: theme.textMuted }}>Data sources</Text>
        <Text style={{ fontSize: 10, color: theme.textMuted, marginLeft: 2 }} accessibilityElementsHidden>
          {open ? '↑' : '↓'}
        </Text>
      </Pressable>
      {open ? <SourcePills manifest={manifest} /> : null}
    </View>
  );
}
