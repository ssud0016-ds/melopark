import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { BottomTabBarHeightCallbackContext } from '@react-navigation/bottom-tabs';
import { useContext } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { LiveMapIcon } from '../components/nav/icons/LiveMapIcon';
import { PredictionsIcon } from '../components/nav/icons/PredictionsIcon';
import { useThemeColors } from '../hooks/useThemeColors';
import type { TabParamList } from './types';

const ICON_SIZE = 18;
const LABEL_SIZE = 10;

type TabId = keyof TabParamList;

const TABS: { route: TabId; label: string }[] = [
  { route: 'MapTab', label: 'Live Map' },
  { route: 'PredictionsTab', label: 'Predictions' },
];

export function MeloparkTabBar({ state, navigation, descriptors }: BottomTabBarProps) {
  const theme = useThemeColors();
  const onHeightChange = useContext(BottomTabBarHeightCallbackContext);
  const focusedRoute = state.routes[state.index];
  const tabBarStyle = descriptors[focusedRoute.key].options.tabBarStyle as ViewStyle | undefined;

  if (tabBarStyle?.display === 'none') {
    return null;
  }

  return (
    <View
      style={tabBarStyle}
      onLayout={(e) => onHeightChange?.(e.nativeEvent.layout.height)}
    >
      <View style={styles.row}>
        {TABS.map(({ route, label }) => {
          const index = state.routes.findIndex((r) => r.name === route);
          const focused = state.index === index;
          const color = focused ? theme.tabActive : theme.tabInactive;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: state.routes[index].key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route);
            }
          };

          return (
            <Pressable
              key={route}
              accessibilityRole="button"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
              onPress={onPress}
              style={styles.tab}
            >
              {route === 'MapTab' ? (
                <LiveMapIcon focused={focused} color={color} size={ICON_SIZE} />
              ) : (
                <PredictionsIcon focused={focused} color={color} size={ICON_SIZE} />
              )}
              <Text style={[styles.label, { color }]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flex: 1,
    flexDirection: 'row',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 4,
    gap: 1,
  },
  label: {
    fontSize: LABEL_SIZE,
    fontWeight: '600',
    letterSpacing: -0.2,
    lineHeight: 12,
  },
});
