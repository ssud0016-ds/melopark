import { View } from 'react-native';

import { colors } from '../../design-system';

export type BayStatus = 'good' | 'caution' | 'avoid' | 'unknown';
//   good    = free        (status-good   #15803d, green)
//   caution = restricted  (status-caution #b45309, amber) — bay_type ∈ Loading Zone / No Standing / Disabled
//   avoid   = occupied    (status-avoid  #b91c1c, red)
//   unknown = sensor null (status-unknown #94a3b8, grey)

const statusColors: Record<BayStatus, string> = {
  good: colors.statusGood,
  caution: colors.statusCaution,
  avoid: colors.statusAvoid,
  unknown: colors.statusUnknown,
};

type Props = {
  status: BayStatus;
  selected?: boolean;
};

export function MarkerDot({ status, selected = false }: Props) {
  const size = selected ? 14 : 10;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? colors.brand : colors.surface,
        backgroundColor: statusColors[status],
      }}
    />
  );
}
