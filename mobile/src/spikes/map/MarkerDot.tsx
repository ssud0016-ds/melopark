import { View } from 'react-native';

import { colors } from '../../design-system';
import type { MockMarkerStatus } from './mockMarkers';

type MarkerDotProps = {
  status: MockMarkerStatus;
};

const statusColors: Record<MockMarkerStatus, string> = {
  good: colors.statusGood,
  caution: colors.statusCaution,
  avoid: colors.statusAvoid,
  unknown: colors.statusUnknown,
};

export function MarkerDot({ status }: MarkerDotProps) {
  return (
    <View
      style={{
        width: 10,
        height: 10,
        borderRadius: 5,
        borderWidth: 1,
        borderColor: colors.surface,
        backgroundColor: statusColors[status],
      }}
    />
  );
}
