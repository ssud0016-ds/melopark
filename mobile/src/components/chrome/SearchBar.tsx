import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Keyboard,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, motion, nativeSearchBarHeight, useReducedMotion, zIndex } from '../../design-system';
import { MAP_SEARCH_COPY } from '../../content/searchCopy';
import { LANDMARKS, type Landmark } from '../../data/landmarks';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useThemeColors } from '../../hooks/useThemeColors';
import { apiBase } from '../../services/api';
import { LogoMark } from '../common/LogoMark';

export type SearchBarVariant = 'map' | 'predictions';

export type SearchBarRef = {
  dismiss: () => void;
};

type Props = {
  destination: Landmark | null;
  onPick: (l: Landmark) => void;
  onClear: () => void;
  onSettingsOpen: () => void;
  onNavTrigger?: () => void;
  variant?: SearchBarVariant;
  onboardingActive?: boolean;
  onFirstTap?: () => void;
  onFocusChange?: (focused: boolean) => void;
};

type LandmarkApiResult = {
  name?: string;
  street_name?: string;
  sub?: string;
  lat: number;
  lng?: number;
  lon?: number;
};

function truncate(s: string, n = 26) {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

function categoryGlyph(): string {
  return '•';
}

function highlight(text: string, q: string): { match: string; before: string; after: string } | null {
  if (!q) return null;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return null;
  return {
    before: text.slice(0, idx),
    match: text.slice(idx, idx + q.length),
    after: text.slice(idx + q.length),
  };
}

export const SearchBar = forwardRef<SearchBarRef, Props>(function SearchBar(
  {
    destination,
    onPick,
    onClear,
    onSettingsOpen,
    onNavTrigger,
    variant = 'map',
    onboardingActive = false,
    onFirstTap,
    onFocusChange,
  },
  ref,
) {
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  const [query, setQuery] = useState('');
  const [apiResults, setApiResults] = useState<Landmark[]>([]);
  const [apiLoading, setApiLoading] = useState(false);
  const [showEmpty, setShowEmpty] = useState(false);
  const debouncedQ = useDebouncedValue(query, 300);
  const reduced = useReducedMotion();
  const theme = useThemeColors();

  const setFocusedState = useCallback(
    (next: boolean) => {
      setFocused(next);
      onFocusChange?.(next);
    },
    [onFocusChange],
  );

  const dismissSearch = useCallback(() => {
    inputRef.current?.blur();
    Keyboard.dismiss();
    setFocusedState(false);
  }, [setFocusedState]);

  useImperativeHandle(ref, () => ({ dismiss: dismissSearch }), [dismissSearch]);

  useEffect(() => {
    if (!focused) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      dismissSearch();
      return true;
    });
    return () => sub.remove();
  }, [focused, dismissSearch]);

  const [ringState, setRingState] = useState<'pulse' | 'static' | 'none'>(
    onboardingActive ? (reduced ? 'static' : 'pulse') : 'none',
  );
  useEffect(() => {
    if (!onboardingActive) {
      setRingState('none');
    } else {
      setRingState(reduced ? 'static' : 'pulse');
    }
  }, [onboardingActive, reduced]);
  useEffect(() => {
    if (destination) setRingState('none');
  }, [destination]);

  const ringOpacity = useSharedValue(0);
  const ringScale = useSharedValue(1);
  useEffect(() => {
    if (ringState === 'none') {
      ringOpacity.value = withTiming(0, { duration: motion.fast });
      ringScale.value = 1;
      return;
    }
    if (ringState === 'static') {
      ringOpacity.value = withTiming(1, { duration: motion.fast });
      ringScale.value = 1;
      return;
    }
    ringOpacity.value = withRepeat(withTiming(1, { duration: motion.pulseRing.duration }), -1, true);
    ringScale.value = withRepeat(withTiming(1.06, { duration: motion.pulseRing.duration }), -1, true);
  }, [ringState, ringOpacity, ringScale]);

  const ringStyle = useAnimatedStyle(() => ({ opacity: ringOpacity.value, transform: [{ scale: ringScale.value }] }));

  useEffect(() => {
    const q = debouncedQ.trim();
    if (!q) {
      setApiResults([]);
      setApiLoading(false);
      return;
    }
    let cancelled = false;
    setApiLoading(true);
    const ctrl = new AbortController();
    const base = apiBase();
    const url = `${base}/api/search?q=${encodeURIComponent(q)}&limit=8`;
    fetch(url, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: LandmarkApiResult[] | unknown) => {
        if (cancelled) return;
        const arr = Array.isArray(rows) ? rows : [];
        const mapped: Landmark[] = arr
          .map((r) => ({
            name: r.name ?? r.street_name ?? '',
            sub: r.sub ?? r.street_name ?? '',
            lat: Number(r.lat),
            lng: Number(r.lng ?? r.lon),
            category: 'street' as const,
          }))
          .filter((l) => l.name && Number.isFinite(l.lat) && Number.isFinite(l.lng));
        setApiResults(mapped);
      })
      .catch(() => {
        if (!cancelled) setApiResults([]);
      })
      .finally(() => {
        if (!cancelled) setApiLoading(false);
      });
    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [debouncedQ]);

  useEffect(() => {
    if (!query.trim() || apiLoading) {
      setShowEmpty(false);
      return;
    }
    const t = setTimeout(() => setShowEmpty(true), 250);
    return () => clearTimeout(t);
  }, [query, apiLoading]);

  const dropdownResults = useMemo<Landmark[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return LANDMARKS.slice(0, 8);
    const local = LANDMARKS.filter(
      (l) => l.name.toLowerCase().includes(q) || l.sub.toLowerCase().includes(q),
    );
    const seen = new Set(local.map((l) => l.name));
    const merged = [...local, ...apiResults.filter((l) => !seen.has(l.name))];
    return merged.slice(0, 8);
  }, [query, apiResults]);

  const showDropdown = focused && variant === 'map';
  const inputValue = destination ? truncate(destination.name) : query;
  const showCancel = focused && !destination;

  const handleFocus = () => {
    setFocusedState(true);
    if (onboardingActive && ringState === 'pulse') {
      setRingState('static');
      onFirstTap?.();
    }
    if (variant === 'predictions') onNavTrigger?.();
  };

  const handleBlur = () => {
    setTimeout(() => setFocusedState(false), 120);
  };

  const handlePick = (l: Landmark) => {
    setQuery('');
    inputRef.current?.blur();
    Keyboard.dismiss();
    setFocusedState(false);
    onPick(l);
  };

  return (
    <View
      style={{
        position: 'absolute',
        top: Math.max(insets.top, 8),
        left: 14,
        right: 14,
        zIndex: zIndex.searchBar,
      }}
      pointerEvents="box-none"
    >
      <View style={{ position: 'relative' }}>
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              top: -4,
              left: -4,
              right: -4,
              bottom: -4,
              borderRadius: 14,
              borderWidth: 2,
              borderColor: colors.accent,
            },
            ringStyle,
          ]}
        />
        <View
          accessibilityRole="search"
          accessibilityLabel={
            destination ? `Destination ${destination.name}` : MAP_SEARCH_COPY.accessibilityLabelEmpty
          }
          style={{
            height: nativeSearchBarHeight,
            borderRadius: 12,
            backgroundColor: theme.chrome,
            borderWidth: 1,
            borderColor: theme.border,
            flexDirection: 'row',
            alignItems: 'center',
            shadowColor: '#000',
            shadowOpacity: 0.08,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 2 },
            elevation: 4,
          }}
        >
          <View style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
            <LogoMark size={28} />
          </View>
          <TextInput
            ref={inputRef}
            value={inputValue}
            editable={!destination}
            onChangeText={setQuery}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onSubmitEditing={dismissSearch}
            placeholder={MAP_SEARCH_COPY.placeholder}
            placeholderTextColor={theme.textMuted}
            style={{ flex: 1, minWidth: 0, fontSize: 14, color: theme.text }}
            returnKeyType="search"
            accessibilityLabel="Search input"
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open settings"
            onPress={onSettingsOpen}
            style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ fontSize: 20, color: theme.tabActive }}>⚙</Text>
          </Pressable>
          {showCancel ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close search"
              onPress={dismissSearch}
              style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ fontSize: 22, color: theme.textMuted }}>×</Text>
            </Pressable>
          ) : null}
          {destination ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear destination"
              onPress={() => {
                setQuery('');
                onClear();
              }}
              style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ fontSize: 22, color: theme.textMuted }}>×</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {showDropdown ? (
        <View
          style={{
            marginTop: 6,
            borderRadius: 12,
            backgroundColor: theme.chrome,
            borderWidth: 1,
            borderColor: theme.border,
            maxHeight: 360,
            shadowColor: '#000',
            shadowOpacity: 0.12,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 4 },
            elevation: 6,
            overflow: 'hidden',
          }}
        >
          {apiLoading ? (
            <View style={{ padding: 12 }}>
              <ActivityIndicator color={colors.brand} />
            </View>
          ) : null}
          {!apiLoading && query.trim() && showEmpty && dropdownResults.length === 0 ? (
            <View style={{ padding: 16 }}>
              <Text style={{ fontSize: 13, color: theme.textSecondary }}>{MAP_SEARCH_COPY.emptyHint}</Text>
            </View>
          ) : null}
          {!query.trim() ? (
            <View style={{ paddingHorizontal: 12, paddingTop: 10, paddingBottom: 4 }}>
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: '700',
                  letterSpacing: 0.5,
                  textTransform: 'uppercase',
                  color: theme.textMuted,
                }}
              >
                {MAP_SEARCH_COPY.dropdownSection}
              </Text>
            </View>
          ) : null}
          <ScrollView keyboardShouldPersistTaps="handled">
            {dropdownResults.map((l, i) => {
              const h = highlight(l.name, query.trim());
              return (
                <Pressable
                  key={`${l.name}-${l.lat}-${l.lng}-${i}`}
                  accessibilityRole="button"
                  onPress={() => handlePick(l)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    minHeight: 44,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    gap: 12,
                  }}
                >
                  <Text style={{ fontSize: 18, color: colors.brand, width: 20, textAlign: 'center' }}>
                    {categoryGlyph()}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: theme.text }} numberOfLines={1}>
                      {h ? (
                        <>
                          {h.before}
                          <Text style={{ fontWeight: '800', color: colors.brand }}>{h.match}</Text>
                          {h.after}
                        </>
                      ) : (
                        l.name
                      )}
                    </Text>
                    <Text style={{ fontSize: 12, color: theme.textSecondary }} numberOfLines={1}>
                      {l.sub}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
});
