import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';

export const fontFamily = {
  sans: 'Inter_400Regular',
  sansMedium: 'Inter_500Medium',
  sansSemiBold: 'Inter_600SemiBold',
  sansBold: 'Inter_700Bold',
  sansExtraBold: 'Inter_800ExtraBold',
} as const;

export const interFontMap = {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} as const;

export const typography = {
  display: { fontSize: 34, fontFamily: fontFamily.sansExtraBold },
  heading: { fontSize: 20, fontFamily: fontFamily.sansBold },
  title: { fontSize: 16, fontFamily: fontFamily.sansSemiBold },
  body: { fontSize: 14, fontFamily: fontFamily.sans },
  label: { fontSize: 12, fontFamily: fontFamily.sansMedium },
  caption: { fontSize: 11, fontFamily: fontFamily.sansMedium },
} as const;

export type TypographyToken = keyof typeof typography;
