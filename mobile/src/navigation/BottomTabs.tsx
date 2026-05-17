import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View } from 'react-native';

import { LiveMapIcon } from '../components/nav/icons/LiveMapIcon';
import { PredictionsIcon } from '../components/nav/icons/PredictionsIcon';
import { colors, nativeTabBarHeight, zIndex } from '../design-system';
import { MapScreen } from '../screens/MapScreen';
import { PredictionsScreen } from '../screens/PredictionsScreen';
import type { TabParamList } from './types';

const Tab = createBottomTabNavigator<TabParamList>();

function IconWrap({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', minWidth: 44, minHeight: 44 }}>
      {children}
    </View>
  );
}

export function BottomTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
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
        options={{
          tabBarLabel: 'Live Map',
          tabBarIcon: ({ focused, color }) => (
            <IconWrap>
              <LiveMapIcon focused={focused} color={color} />
            </IconWrap>
          ),
        }}
      />
      <Tab.Screen
        name="PredictionsTab"
        component={PredictionsScreen}
        options={{
          tabBarLabel: 'Predictions',
          tabBarIcon: ({ focused, color }) => (
            <IconWrap>
              <PredictionsIcon focused={focused} color={color} />
            </IconWrap>
          ),
        }}
      />
    </Tab.Navigator>
  );
}
