import { useEffect, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

import { colors, haptics, zIndex } from '../../design-system';
import { useThemeColors } from '../../hooks/useThemeColors';
import type { MapsProvider } from '../../hooks/useMapsProvider';

export const MAPS_PROVIDER_LABELS: Record<MapsProvider, string> = {
  google: 'Google Maps',
  waze: 'Waze',
  web: 'Browser fallback',
};

const OPTIONS: { value: MapsProvider; label: string; sub: string }[] = [
  { value: 'google', label: 'Google Maps', sub: 'Native Google Maps app' },
  { value: 'waze', label: 'Waze', sub: 'Crowd-sourced traffic + navigation' },
  { value: 'web', label: 'Web', sub: 'Browser fallback (Google Maps)' },
];

type Props = {
  visible: boolean;
  initialProvider?: MapsProvider | null;
  showRemember?: boolean;
  confirmLabel?: string;
  onConfirm: (provider: MapsProvider, remember: boolean) => void;
  onClose: () => void;
};

export function MapsProviderChooserModal({
  visible,
  initialProvider = null,
  showRemember = true,
  confirmLabel = 'Continue',
  onConfirm,
  onClose,
}: Props) {
  const theme = useThemeColors();
  const [selected, setSelected] = useState<MapsProvider>(initialProvider ?? 'google');
  const [remember, setRemember] = useState(true);

  useEffect(() => {
    if (visible) {
      setSelected(initialProvider ?? 'google');
      setRemember(true);
    }
  }, [visible, initialProvider]);

  const confirm = () => {
    haptics.light();
    onConfirm(selected, showRemember ? remember : true);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <View
        style={{
          flex: 1,
          zIndex: zIndex.mapsChooser,
          justifyContent: 'center',
          paddingHorizontal: 16,
        }}
      >
        <Pressable
          testID="maps-provider-chooser-backdrop"
          accessibilityRole="button"
          accessibilityLabel="Close maps app chooser"
          onPress={onClose}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.35)',
          }}
        />
        <View
          testID="maps-provider-chooser"
          style={{
            borderRadius: 16,
            backgroundColor: theme.sheet,
            padding: 24,
            maxWidth: 360,
            width: '100%',
            alignSelf: 'center',
          }}
        >
          <Text
            accessibilityRole="header"
            style={{ fontSize: 20, fontWeight: '700', color: theme.text }}
          >
            Choose your maps app
          </Text>
          <Text style={{ fontSize: 14, color: theme.textSecondary, marginTop: 4 }}>
            MelOPark will use this whenever you open directions.
          </Text>

          <View style={{ marginTop: 16, gap: 8 }} accessibilityRole="radiogroup">
            {OPTIONS.map((opt) => {
              const isSelected = selected === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={`${opt.label}. ${opt.sub}`}
                  onPress={() => {
                    haptics.selection();
                    setSelected(opt.value);
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    gap: 12,
                    minHeight: 44,
                    borderRadius: 10,
                    borderWidth: isSelected ? 2 : 1,
                    borderColor: isSelected ? colors.brand : theme.border,
                    backgroundColor: isSelected ? theme.statusGoodBg : theme.chrome,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                  }}
                >
                  <View
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: 8,
                      borderWidth: 2,
                      borderColor: isSelected ? colors.brand : theme.textMuted,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginTop: 2,
                    }}
                  >
                    {isSelected ? (
                      <View
                        style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brand }}
                      />
                    ) : null}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: theme.text }}>{opt.label}</Text>
                    <Text style={{ fontSize: 12, color: theme.textSecondary, marginTop: 2 }}>{opt.sub}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          {showRemember ? (
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: remember }}
              accessibilityLabel="Remember my choice"
              onPress={() => setRemember((v) => !v)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16 }}
            >
              <View
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 4,
                  borderWidth: 2,
                  borderColor: colors.brand,
                  backgroundColor: remember ? colors.brand : 'transparent',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {remember ? (
                  <Text style={{ color: colors.surface, fontSize: 12, fontWeight: '700' }}>✓</Text>
                ) : null}
              </View>
              <Text style={{ fontSize: 14, color: theme.text }}>Remember my choice</Text>
            </Pressable>
          ) : null}

          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 24 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              onPress={onClose}
              style={{
                minHeight: 44,
                borderRadius: 10,
                paddingHorizontal: 16,
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: '600', color: theme.textSecondary }}>Cancel</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={confirmLabel}
              onPress={confirm}
              style={{
                minHeight: 44,
                borderRadius: 10,
                backgroundColor: colors.brand,
                paddingHorizontal: 16,
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.surface }}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
