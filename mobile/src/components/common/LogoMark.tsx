import { Image, type ImageStyle } from 'react-native';

import { useDarkMode } from '../../hooks/useDarkMode';

const logoLight = require('../../../assets/logo/mobile-light.png');
const logoDark = require('../../../assets/logo/mobile-dark.png');

type LogoMarkProps = {
  size?: number;
  /** When set, overrides system theme (light basemap → light asset). */
  variant?: 'light' | 'dark';
};

/**
 * Search-bar brand mark (car + magnifier). Matches web LogoMark.jsx assets.
 */
export function LogoMark({ size = 24, variant }: LogoMarkProps) {
  const { dark } = useDarkMode();
  const useDark = variant != null ? variant === 'dark' : dark;
  const source = useDark ? logoDark : logoLight;

  const style: ImageStyle = {
    width: size,
    height: size,
  };

  return (
    <Image
      source={source}
      style={style}
      accessibilityRole="image"
      accessibilityLabel="MelOPark"
      resizeMode="contain"
    />
  );
}
