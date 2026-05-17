import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type ScreenProps = {
  title: string;
  subtitle?: string;
  children?: ReactNode;
};

// Phase 2.B stub screen wrapper. Replaced per-screen in 2.D–2.J.
export function Screen({ title, subtitle, children }: ScreenProps) {
  const insets = useSafeAreaInsets();
  return (
    <View
      className="flex-1 bg-surface dark:bg-surface-dark"
      style={{ paddingTop: insets.top }}
    >
      <View className="gap-1 px-6 pb-4 pt-4">
        <Text className="font-sans text-2xl font-bold text-brand dark:text-accent">{title}</Text>
        {subtitle ? (
          <Text className="font-sans text-sm text-gray-500 dark:text-gray-300">{subtitle}</Text>
        ) : null}
      </View>
      <View className="flex-1 px-6">{children}</View>
    </View>
  );
}
