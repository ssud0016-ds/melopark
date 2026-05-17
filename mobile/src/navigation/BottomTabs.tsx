import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View } from 'react-native';

import { colors, nativeTabBarHeight, zIndex } from '../design-system';
import { MapScreen } from '../screens/MapScreen';
import { PredictionsScreen } from '../screens/PredictionsScreen';
import { SearchScreen } from '../screens/SearchScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import type { TabParamList } from './types';

const Tab = createBottomTabNavigator<TabParamList>();

type TabIconProps = { focused: boolean; label: string };

// Placeholder text-icon. Phase 2.D replaces with vector glyphs (icon font choice still open).
function TabIcon({ focused, label }: TabIconProps) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', minWidth: 44, minHeight: 44 }}>
      <Text
        style={{
          fontSize: 11,
          fontWeight: focused ? '700' : '500',
          color: focused ? colors.brand : colors.surfaceDarkTertiary,
        }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

export function BottomTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        // Plan §7: tab bar absolute + zIndex 490 so sheet at zIndex 550 can overlay it.
        // MapScreen toggles tabBarStyle.display via setOptions when sheet snaps to top.
        tabBarStyle: {
          position: 'absolute',
          height: nativeTabBarHeight,
          backgroundColor: colors.surface,
          borderTopColor: colors.surfaceTertiary,
          borderTopWidth: 0.5,
          zIndex: zIndex.tabBar,
        },
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.surfaceDarkTertiary,
      }}
    >
      <Tab.Screen
        name="MapTab"
        component={MapScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon focused={focused} label="Map" /> }}
      />
      <Tab.Screen
        name="PredictionsTab"
        component={PredictionsScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon focused={focused} label="Predict" /> }}
      />
      <Tab.Screen
        name="SearchTab"
        component={SearchScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon focused={focused} label="Search" /> }}
      />
      <Tab.Screen
        name="SettingsTab"
        component={SettingsScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon focused={focused} label="Settings" /> }}
      />
    </Tab.Navigator>
  );
}
