import { Pressable } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import type { Bay } from '../../services/apiBays';
import { getStatusFillColor, type BayStatus } from '../../utils/pressureSegmentStyle';

/** Material accessible icon — matches web ParkingMap + MapLegend. */
const WHEELCHAIR_PATH =
  'M12 2c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2m9 7h-6v13h-2v-6h-2v6H9V9H3V7h18v2z';

function bayStatusForColor(type: Bay['type']): BayStatus {
  if (type === 'trap') return 'caution';
  if (type === 'occupied') return 'occupied';
  if (type === 'available') return 'available';
  return 'unknown';
}

type Props = {
  bay: Bay;
  colorBlindMode: boolean;
  selected: boolean;
  onPress: () => void;
};

export function AccessibleBayMapMarker({ bay, colorBlindMode, selected, onPress }: Props) {
  const fill = getStatusFillColor(bayStatusForColor(bay.type), colorBlindMode);
  const size = selected ? 30 : 22;

  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Accessible bay ${bay.id}`}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Circle cx="12" cy="12" r="12" fill={fill} />
        <Path fill="#ffffff" d={WHEELCHAIR_PATH} />
      </Svg>
    </Pressable>
  );
}
