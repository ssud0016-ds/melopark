import './global.css';

import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import { useColorScheme } from 'nativewind';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { colors, interFontMap, rootStyle } from './src/design-system';
import { PlaceholderScreen } from './src/screens/PlaceholderScreen';
import { MapSpikeScreen } from './src/spikes/map/MapSpikeScreen';

SplashScreen.preventAutoHideAsync().catch(() => {
  // No-op: splash hidden by OS already on hot reload.
});

type Route = 'placeholder' | 'spike';

const FONT_TIMEOUT_MS = 5000;

export default function App() {
  const [fontsLoaded, fontError] = useFonts(interFontMap);
  const [fontTimeout, setFontTimeout] = useState(false);
  const [route, setRoute] = useState<Route>('placeholder');
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

  if (!ready) {
    return null;
  }

  return (
    <GestureHandlerRootView style={rootStyle}>
      <SafeAreaProvider>
        {route === 'placeholder' ? (
          <PlaceholderScreen onOpenSpike={() => setRoute('spike')} />
        ) : (
          <MapSpikeScreen />
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
