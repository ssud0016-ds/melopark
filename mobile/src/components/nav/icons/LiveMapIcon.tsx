import Svg, { Path } from 'react-native-svg';

type Props = { focused: boolean; color: string; size?: number };

export function LiveMapIcon({ focused, color, size = 24 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"
        fill={focused ? color : 'none'}
        stroke={color}
        strokeWidth={focused ? 0 : 1.8}
      />
    </Svg>
  );
}
