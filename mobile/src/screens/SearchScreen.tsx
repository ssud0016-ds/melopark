import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, haptics } from '../design-system';
import { useBays } from '../hooks/useBays';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import type { RootStackParamList } from '../navigation/types';
import type { Bay } from '../services/apiBays';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const MAX_RESULTS = 50;

export function SearchScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { bays, loading } = useBays();
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 150);

  const results = useMemo<Bay[]>(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return [];
    const matches: Bay[] = [];
    for (const b of bays) {
      if (matches.length >= MAX_RESULTS) break;
      const idMatch = b.id.toLowerCase().includes(q);
      const nameMatch = b.name?.toLowerCase().includes(q);
      if (idMatch || nameMatch) matches.push(b);
    }
    return matches;
  }, [bays, debouncedQuery]);

  const onPickBay = useCallback(
    (bay: Bay) => {
      haptics.light();
      Keyboard.dismiss();
      navigation.navigate('Tabs', {
        screen: 'MapTab',
        params: { bayId: bay.id },
      });
    },
    [navigation],
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-surface dark:bg-surface-dark"
      style={{ paddingTop: insets.top }}
    >
      <View className="gap-3 px-6 pb-3 pt-4">
        <Text className="font-sans text-2xl font-bold text-brand dark:text-accent">Search</Text>
        <View className="flex-row items-center gap-2 rounded-2xl bg-surface-tertiary px-4 py-3 dark:bg-surface-dark-secondary">
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Street name or bay ID"
            placeholderTextColor={colors.surfaceDarkTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={Keyboard.dismiss}
            className="flex-1 font-sans text-base text-gray-900 dark:text-gray-300"
            accessibilityLabel="Search bays"
          />
          {query ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              onPress={() => setQuery('')}
              hitSlop={8}
            >
              <Text className="font-sans text-lg text-gray-500">×</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {loading && bays.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.brand} />
        </View>
      ) : debouncedQuery.trim() === '' ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center font-sans text-sm text-gray-500">
            Type a street name or bay ID to find a parking bay.
          </Text>
        </View>
      ) : results.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center font-sans text-sm text-gray-500">
            No bays match “{debouncedQuery}”.
          </Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(b) => b.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 24 }}
          ItemSeparatorComponent={() => <View className="h-px bg-surface-tertiary dark:bg-surface-dark-secondary" />}
          renderItem={({ item }) => <Row bay={item} onPress={onPickBay} />}
        />
      )}
    </KeyboardAvoidingView>
  );
}

function Row({ bay, onPress }: { bay: Bay; onPress: (bay: Bay) => void }) {
  const tint =
    bay.type === 'available'
      ? colors.statusGood
      : bay.type === 'trap'
        ? colors.statusCaution
        : bay.type === 'occupied'
          ? colors.statusAvoid
          : colors.statusUnknown;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => onPress(bay)}
      className="min-h-[44px] flex-row items-center gap-3 py-3"
    >
      <View
        style={{
          width: 10,
          height: 10,
          borderRadius: 5,
          backgroundColor: tint,
          borderWidth: 1,
          borderColor: colors.surface,
        }}
      />
      <View className="flex-1">
        <Text className="font-sans text-sm font-semibold text-gray-900 dark:text-gray-300" numberOfLines={1}>
          {bay.name ?? `Bay ${bay.id}`}
        </Text>
        <Text className="font-sans text-xs text-gray-500" numberOfLines={1}>
          ID {bay.id} · {bay.bayType}
        </Text>
      </View>
      <Text className="font-sans text-base text-gray-400">›</Text>
    </Pressable>
  );
}
