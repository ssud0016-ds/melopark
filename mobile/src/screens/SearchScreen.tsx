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

import { colors, haptics, statusColor } from '../design-system';
import { useBays } from '../hooks/useBays';
import { useColorBlindMode } from '../hooks/useColorBlindMode';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import type { RootStackParamList } from '../navigation/types';
import type { Bay } from '../services/apiBays';
import { buildSearchResults, type DestinationResult, type SearchResult } from './searchPlanning';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function SearchScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { bays, loading } = useBays();
  const { enabled: colorBlindMode } = useColorBlindMode();
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 150);

  const results = useMemo<SearchResult[]>(
    () => buildSearchResults(bays, debouncedQuery),
    [bays, debouncedQuery],
  );

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

  const onPickDestination = useCallback(
    (destination: DestinationResult) => {
      haptics.light();
      Keyboard.dismiss();
      navigation.navigate('Tabs', {
        screen: 'MapTab',
        params: {
          planningMode: 'destination',
          destinationLat: destination.lat,
          destinationLng: destination.lng,
          destinationLabel: destination.label,
        },
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
        <Text className="font-sans text-sm text-gray-500 dark:text-gray-300">
          Find a bay, or choose a street as your planning destination.
        </Text>
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
            accessibilityLabel="Search bays and destinations"
          />
          {query ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              onPress={() => setQuery('')}
              hitSlop={8}
            >
              <Text className="font-sans text-lg text-gray-500">x</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {loading && bays.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.brand} />
        </View>
      ) : debouncedQuery.trim() === '' ? (
        <EmptyState message="Type a street name to plan near a destination, or a bay ID to open a bay." />
      ) : results.length === 0 ? (
        <EmptyState message={`No bays or streets match "${debouncedQuery}"`} />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => (item.kind === 'destination' ? item.id : `bay:${item.bay.id}`)}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 24 }}
          ItemSeparatorComponent={() => (
            <View className="h-px bg-surface-tertiary dark:bg-surface-dark-secondary" />
          )}
          renderItem={({ item }) =>
            item.kind === 'destination' ? (
              <DestinationRow destination={item} onPress={onPickDestination} />
            ) : (
              <BayRow bay={item.bay} colorBlindMode={colorBlindMode} onPress={onPickBay} />
            )
          }
        />
      )}
    </KeyboardAvoidingView>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <View className="flex-1 items-center justify-center px-6">
      <Text className="text-center font-sans text-sm text-gray-500">{message}</Text>
    </View>
  );
}

function DestinationRow({
  destination,
  onPress,
}: {
  destination: DestinationResult;
  onPress: (destination: DestinationResult) => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => onPress(destination)}
      className="min-h-[56px] flex-row items-center gap-3 py-3"
    >
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: colors.brand,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: colors.surface, fontSize: 12, fontWeight: '700' }}>P</Text>
      </View>
      <View className="flex-1">
        <Text className="font-sans text-sm font-semibold text-gray-900 dark:text-gray-300" numberOfLines={1}>
          Plan near {destination.label}
        </Text>
        <Text className="font-sans text-xs text-gray-500" numberOfLines={1}>
          Destination from {destination.bayCount} nearby bays
        </Text>
      </View>
      <Text className="font-sans text-base text-gray-400">&gt;</Text>
    </Pressable>
  );
}

export function baySearchStatusColor(type: Bay['type'], colorBlindMode = false) {
  if (type === 'available') return statusColor('good', colorBlindMode);
  if (type === 'trap') return statusColor('caution', colorBlindMode);
  if (type === 'occupied') return statusColor('avoid', colorBlindMode);
  return statusColor('unknown', colorBlindMode);
}

function BayRow({
  bay,
  colorBlindMode,
  onPress,
}: {
  bay: Bay;
  colorBlindMode: boolean;
  onPress: (bay: Bay) => void;
}) {
  const tint = baySearchStatusColor(bay.type, colorBlindMode);

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
          Open bay {bay.id} - {bay.bayType}
        </Text>
      </View>
      <Text className="font-sans text-base text-gray-400">&gt;</Text>
    </Pressable>
  );
}
