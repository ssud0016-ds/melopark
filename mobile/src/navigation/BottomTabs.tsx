import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useThemeColors } from '../hooks/useThemeColors';
import { MapScreen } from '../screens/MapScreen';
import { PredictionsScreen } from '../screens/PredictionsScreen';
import { MeloparkTabBar } from './MeloparkTabBar';
import { getTabBarStyle } from './tabBarStyle';
import type { TabParamList } from './types';

const Tab = createBottomTabNavigator<TabParamList>();

export function BottomTabs() {
  const theme = useThemeColors();
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      tabBar={(props) => <MeloparkTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarStyle: getTabBarStyle(theme, insets.bottom),
      }}
    >
      <Tab.Screen name="MapTab" component={MapScreen} />
      <Tab.Screen name="PredictionsTab" component={PredictionsScreen} />
    </Tab.Navigator>
  );
}
