import { Text, View } from 'react-native';

import { useDarkMode } from '../../../hooks/useDarkMode';
import { predictionsSectionLabel } from '../predictionsTheme';

const LEGEND = [
  ['#1D9E75', 'Low 0 to 20'],
  ['#BA7517', 'Mod 21 to 40'],
  ['#D85A30', 'High 41+'],
] as const;

export function CbdArcLegend() {
  const { dark } = useDarkMode();
  const labelColor = predictionsSectionLabel(dark);

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12 }}>
      {LEGEND.map(([c, l]) => (
        <View key={l} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c }} />
          <Text style={{ fontSize: 10, color: labelColor }}>{l}</Text>
        </View>
      ))}
    </View>
  );
}
