import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { colors } from '../../design-system';

type Props = {
  type: 'sun' | 'rule' | 'alert' | 'search';
  color?: string;
};

export function AboutFeatureIcon({ type, color = colors.brand }: Props) {
  const stroke = color;
  const sw = 1.75;

  if (type === 'rule') {
    return (
      <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden>
        <Rect x={4} y={3} width={16} height={18} rx={2} stroke={stroke} strokeWidth={sw} />
        <Path d="M8 7h8M8 11h8M8 15h5" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
      </Svg>
    );
  }

  if (type === 'alert') {
    return (
      <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden>
        <Path
          d="M12 3l9 4.5v6c0 5-3.5 7.5-9 9-5.5-1.5-9-4-9-9v-6L12 3z"
          stroke={stroke}
          strokeWidth={sw}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path d="M12 9v4M12 17h.01" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
      </Svg>
    );
  }

  if (type === 'search') {
    return (
      <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden>
        <Circle cx={11} cy={11} r={7} stroke={stroke} strokeWidth={sw} />
        <Path d="M20 20l-3.5-3.5" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
      </Svg>
    );
  }

  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden>
      <Circle cx={12} cy={12} r={8} stroke={stroke} strokeWidth={sw} />
      <Path d="M12 6v6l4 2" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
