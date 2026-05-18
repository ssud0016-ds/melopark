import './global.css';

import Constants from 'expo-constants';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import { useColorScheme } from 'nativewind';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Mapbox from '@rnmapbox/maps';

import { LocationPermissionBanner } from './src/components/common/LocationPermissionBanner';
import { OfflineBanner } from './src/components/common/OfflineBanner';
import { ToastProvider } from './src/components/common/Toast';
import { colors, interFontMap, rootStyle } from './src/design-system';
import { DestinationProvider } from './src/hooks/useDestination';
import { FiltersProvider } from './src/hooks/useFilters';
import { RootNavigator } from './src/navigation/RootNavigator';

SplashScreen.preventAutoHideAsync().catch(() => {});

const mapboxPublicToken =
  (Constants.expoConfig?.extra?.mapboxPublicToken as string | undefined) ??
  process.env.MAPBOX_PUBLIC_TOKEN;

if (mapboxPublicToken) {
  Mapbox.setAccessToken(mapboxPublicToken);
} else {
  console.warn('[mapbox] MAPBOX_PUBLIC_TOKEN missing — map will not render tiles');
}

const FONT_TIMEOUT_MS = 5000;

export default function App() {
  const [fontsLoaded, fontError] = useFonts(interFontMap);
  const [fontTimeout, setFontTimeout] = useState(false);
  const { colorScheme } = useColorScheme();

  useEffect(() => {
    const t = setTimeout(() => setFontTimeout(true), FONT_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const bg = colorScheme === 'dark' ? colors.surfaceDark : colors.surface;
    SystemUI.setBackgroundColorAsync(bg).catch(() => {});
  }, [colorScheme]);

  const ready = fontsLoaded || !!fontError || fontTimeout;

  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [ready]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={rootStyle}>
      <SafeAreaProvider>
        <ToastProvider>
          <FiltersProvider>
            <DestinationProvider>
              <RootNavigator />
              <OfflineBanner />
              <LocationPermissionBanner />
            </DestinationProvider>
          </FiltersProvider>
        </ToastProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
