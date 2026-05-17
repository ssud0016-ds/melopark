import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { MapsProviderChooserScreen } from '../screens/MapsProviderChooserScreen';
import { MapSpikeScreen } from '../spikes/map/MapSpikeScreen';
import { BottomTabs } from './BottomTabs';
import { linking } from './linking';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <NavigationContainer linking={linking}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Tabs" component={BottomTabs} />
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
    </NavigationContainer>
  );
}
