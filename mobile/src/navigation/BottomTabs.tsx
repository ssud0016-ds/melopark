import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

import { colors, nativeTabBarHeight, zIndex } from '../design-system';
import { MapScreen } from '../screens/MapScreen';
import { PredictionsScreen } from '../screens/PredictionsScreen';
import { SearchScreen } from '../screens/SearchScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import type { TabParamList } from './types';

const Tab = createBottomTabNavigator<TabParamList>();

type IconName = 'map' | 'predictions' | 'search' | 'settings';
type TabIconProps = { focused: boolean; label: string; icon: IconName };

function TabIcon({ focused, label, icon }: TabIconProps) {
  const color = focused ? colors.brand : colors.surfaceDarkTertiary;
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', minWidth: 56, minHeight: 48 }}>
      <Glyph name={icon} color={color} focused={focused} />
      <Text
        style={{
          marginTop: 2,
          fontSize: 10,
          fontWeight: focused ? '700' : '500',
          color,
        }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

function Glyph({ name, color, focused }: { name: IconName; color: string; focused: boolean }) {
  const strokeWidth = focused ? 2.4 : 2;
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" accessibilityElementsHidden>
      {name === 'map' ? (
        <>
          <Path
            d="M4 6.5l5-2 6 2 5-2v13l-5 2-6-2-5 2z"
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinejoin="round"
          />
          <Line x1="9" y1="4.5" x2="9" y2="17.5" stroke={color} strokeWidth={strokeWidth} />
          <Line x1="15" y1="6.5" x2="15" y2="19.5" stroke={color} strokeWidth={strokeWidth} />
        </>
      ) : null}
      {name === 'predictions' ? (
        <>
          <Rect x="4" y="11" width="3" height="7" rx="1.5" fill={color} />
          <Rect x="10.5" y="6" width="3" height="12" rx="1.5" fill={color} />
          <Rect x="17" y="9" width="3" height="9" rx="1.5" fill={color} />
          <Path
            d="M4 6l4-2 4 2 4-3 4 2"
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      ) : null}
      {name === 'search' ? (
        <>
          <Circle cx="10.5" cy="10.5" r="5.5" fill="none" stroke={color} strokeWidth={strokeWidth} />
          <Line x1="15" y1="15" x2="20" y2="20" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
        </>
      ) : null}
      {name === 'settings' ? (
        <>
          <Circle cx="12" cy="12" r="3" fill="none" stroke={color} strokeWidth={strokeWidth} />
          <Path
            d="M12 3v3M12 18v3M4.2 7.5l2.6 1.5M17.2 15l2.6 1.5M4.2 16.5l2.6-1.5M17.2 9l2.6-1.5"
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
        </>
      ) : null}
    </Svg>
  );
}

export function BottomTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          position: 'absolute',
          height: nativeTabBarHeight,
          backgroundColor: colors.surface,
          borderTopColor: colors.surfaceTertiary,
          borderTopWidth: 0.5,
          zIndex: zIndex.tabBar,
        },
        tabBarItemStyle: { minHeight: nativeTabBarHeight },
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.surfaceDarkTertiary,
      }}
    >
      <Tab.Screen
        name="MapTab"
        component={MapScreen}
        options={{
          tabBarAccessibilityLabel: 'Map tab',
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} icon="map" label="Map" />,
        }}
      />
      <Tab.Screen
        name="PredictionsTab"
        component={PredictionsScreen}
        options={{
          tabBarAccessibilityLabel: 'Predictions tab',
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} icon="predictions" label="Predict" />
          ),
        }}
      />
      <Tab.Screen
        name="SearchTab"
        component={SearchScreen}
        options={{
          tabBarAccessibilityLabel: 'Search tab',
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} icon="search" label="Search" />,
        }}
      />
      <Tab.Screen
        name="SettingsTab"
        component={SettingsScreen}
        options={{
          tabBarAccessibilityLabel: 'Settings tab',
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} icon="settings" label="Settings" />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
