import { Text, View } from 'react-native';

import { useDarkMode } from '../../hooks/useDarkMode';

const MESSAGE =
  'Live bay availability is unknown for this future time. Parking rules shown are based on the scheduled time only.';

export function FuturePlanningBanner() {
  const { dark } = useDarkMode();
  return (
    <View
      accessibilityRole="alert"
      style={{
        marginHorizontal: 20,
        marginTop: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(245, 158, 11, 0.45)',
        backgroundColor: dark ? 'rgba(120, 53, 15, 0.35)' : 'rgba(255, 251, 235, 0.95)',
        paddingHorizontal: 14,
        paddingVertical: 12,
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
      }}
    >
      <Text style={{ fontSize: 16, lineHeight: 20 }} accessibilityElementsHidden>
        ⚠
      </Text>
      <Text
        style={{
          flex: 1,
          fontSize: 12,
          lineHeight: 18,
          fontWeight: '500',
          color: dark ? '#fcd34d' : '#92400e',
        }}
      >
        {MESSAGE}
      </Text>
    </View>
  );
}
