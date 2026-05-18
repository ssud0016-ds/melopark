import type { ViewStyle } from 'react-native';

// Replaces web `min-h-[100dvh]` token (plan §3.9).
// Native has no address-bar resize problem; flex:1 + SafeAreaProvider is canonical.
export const rootStyle: ViewStyle = { flex: 1 };
