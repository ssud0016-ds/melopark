import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';

import { AboutScreen } from '../screens/AboutScreen';
import { AttributionScreen } from '../screens/AttributionScreen';
import { MapsProviderChooserScreen } from '../screens/MapsProviderChooserScreen';
import { TermsScreen } from '../screens/TermsScreen';
import { MapSpikeScreen } from '../spikes/map/MapSpikeScreen';
import { BottomTabs } from './BottomTabs';
import { linking } from './linking';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <NavigationContainer linking={linking}>
      <BottomSheetModalProvider>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Tabs" component={BottomTabs} />
        <Stack.Screen name="About" component={AboutScreen} options={{ headerShown: true, title: 'About' }} />
        <Stack.Screen
          name="Attribution"
          component={AttributionScreen}
          options={{ headerShown: true, title: 'Attribution' }}
        />
        <Stack.Screen name="Terms" component={TermsScreen} options={{ headerShown: true, title: 'Terms' }} />
        <Stack.Screen
          name="MapsProviderChooser"
          component={MapsProviderChooserScreen}
          options={{ presentation: 'modal', headerShown: true, title: 'Open in…' }}
        />
        <Stack.Screen
          name="MapSpike"
          component={MapSpikeScreen}
          options={{ headerShown: true, title: 'Map spike (dev)' }}
        />
        </Stack.Navigator>
      </BottomSheetModalProvider>
    </NavigationContainer>
  );
}
