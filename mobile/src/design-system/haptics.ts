import * as Haptics from 'expo-haptics';

async function safe(call: () => Promise<void>): Promise<void> {
  try {
    await call();
  } catch {
    // No-op: haptics unsupported or denied. Plan §7.8 acceptance.
  }
}

export const haptics = {
  selection: () => safe(() => Haptics.selectionAsync()),
  light: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  medium: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
} as const;
