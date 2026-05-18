import Svg, { Rect } from 'react-native-svg';

type Props = { focused: boolean; color: string; size?: number };

export function PredictionsIcon({ focused, color, size = 24 }: Props) {
  const fill = focused ? color : 'none';
  const stroke = color;
  const sw = focused ? 0 : 1.8;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={13} width={4} height={8} rx={1} fill={fill} stroke={stroke} strokeWidth={sw} />
      <Rect x={10} y={8} width={4} height={13} rx={1} fill={fill} stroke={stroke} strokeWidth={sw} />
      <Rect x={17} y={4} width={4} height={17} rx={1} fill={fill} stroke={stroke} strokeWidth={sw} />
    </Svg>
  );
}
