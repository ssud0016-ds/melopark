import { BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  HELP_TAB_SECTIONS,
  HELP_TABS,
  type HelpParagraph,
  type HelpSection,
  type HelpTabId,
  type HelpVisual,
} from '../../content/helpContent';
import { colors, sheetSnapPoints } from '../../design-system';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useTabBarLayout } from '../../navigation/tabBarStyle';

export type HelpModalRef = {
  present: () => void;
  dismiss: () => void;
};

type Props = {
  onReplayOnboarding?: () => void;
};

const TAB_CHIP_TEXT = {
  fontSize: 11,
  fontWeight: '700' as const,
  lineHeight: 16,
  ...(Platform.OS === 'android' ? { includeFontPadding: false } : {}),
};

export const HelpModal = forwardRef<HelpModalRef, Props>(({ onReplayOnboarding }, ref) => {
  const sheetRef = useRef<BottomSheetModal>(null);
  const theme = useThemeColors();
  const insets = useSafeAreaInsets();
  const tabBar = useTabBarLayout();
  const snaps = useMemo(() => [...sheetSnapPoints], []);
  const [activeTab, setActiveTab] = useState<HelpTabId>('map');
  const footerBottomPad = Math.max(insets.bottom, 12);

  useImperativeHandle(ref, () => ({
    present: () => {
      setActiveTab('map');
      sheetRef.current?.present();
    },
    dismiss: () => sheetRef.current?.dismiss(),
  }));

  const sections = HELP_TAB_SECTIONS[activeTab];

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={snaps}
      index={1}
      enableDynamicSizing={false}
      bottomInset={tabBar.sheetBottomInset}
      backgroundStyle={{ backgroundColor: theme.sheet }}
      handleIndicatorStyle={{ backgroundColor: theme.handle, width: 32, height: 4 }}
      accessibilityLabel="Help"
    >
      <View style={{ flex: 1 }}>
        <View
          style={{
            paddingHorizontal: 20,
            paddingTop: 4,
            paddingBottom: 12,
            borderBottomWidth: 0.5,
            borderBottomColor: theme.border,
            gap: 2,
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: '800', color: theme.text }}>Help</Text>
          <Text style={{ fontSize: 12, color: theme.textSecondary }}>How MelOPark works</Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingVertical: 12,
            gap: 8,
            alignItems: 'center',
          }}
          style={{ flexGrow: 0 }}
        >
          {HELP_TABS.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <Pressable
                key={tab.id}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => setActiveTab(tab.id)}
                style={{
                  minHeight: 44,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: active ? colors.brand : theme.border,
                  backgroundColor: active ? colors.brand : theme.chromeMuted,
                  justifyContent: 'center',
                }}
              >
                <Text
                  style={{
                    ...TAB_CHIP_TEXT,
                    color: active ? theme.brandOnBrand : theme.textSecondary,
                  }}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <BottomSheetScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 8,
            paddingBottom: 20,
            gap: 20,
          }}
        >
          {sections.map((section) => (
            <HelpSectionBlock key={section.title} section={section} theme={theme} />
          ))}
        </BottomSheetScrollView>

        <View
          style={{
            paddingHorizontal: 20,
            paddingTop: 12,
            paddingBottom: footerBottomPad,
            borderTopWidth: 0.5,
            borderTopColor: theme.border,
            backgroundColor: theme.sheet,
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Replay onboarding tutorial"
            onPress={onReplayOnboarding}
            style={{
              minHeight: 48,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: `${colors.brand}66`,
              backgroundColor: theme.chromeMuted,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: 8,
            }}
          >
            <Text style={{ fontSize: 14, color: theme.textMuted }}>↺</Text>
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.brand }}>Replay onboarding tutorial</Text>
          </Pressable>
        </View>
      </View>
    </BottomSheetModal>
  );
});
HelpModal.displayName = 'HelpModal';

function HelpSectionBlock({
  section,
  theme,
}: {
  section: HelpSection;
  theme: ReturnType<typeof useThemeColors>;
}) {
  return (
    <View style={{ gap: 10 }}>
      <Text
        style={{
          fontSize: 10,
          fontWeight: '700',
          letterSpacing: 1.2,
          color: colors.brand,
          textTransform: 'uppercase',
        }}
      >
        {section.title}
      </Text>
      <View style={{ gap: 12 }}>
        {section.blocks.map((block, i) =>
          block.kind === 'paragraph' ? (
            <HelpParagraphText key={`${section.title}-p-${i}`} block={block} theme={theme} />
          ) : (
            <HelpLegendRow
              key={`${section.title}-l-${i}`}
              visual={block.visual}
              label={block.label}
              sub={block.sub}
              theme={theme}
            />
          ),
        )}
      </View>
    </View>
  );
}

function HelpParagraphText({
  block,
  theme,
}: {
  block: HelpParagraph;
  theme: ReturnType<typeof useThemeColors>;
}) {
  return <Text style={{ fontSize: 14, lineHeight: 21, color: theme.text }}>{block.text}</Text>;
}

function HelpLegendRow({
  visual,
  label,
  sub,
  theme,
}: {
  visual: HelpVisual;
  label: string;
  sub?: string;
  theme: ReturnType<typeof useThemeColors>;
}) {
  const description = sub ?? label;

  if (visual.type === 'badge') {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
        <View style={{ marginTop: 2 }}>{renderVisual(visual)}</View>
        <Text style={{ flex: 1, fontSize: 14, lineHeight: 20, color: theme.text }}>{description}</Text>
      </View>
    );
  }

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
      <View style={{ marginTop: 3, minWidth: 28 }}>{renderVisual(visual)}</View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontSize: 14, lineHeight: 20, fontWeight: '600', color: theme.text }}>{label}</Text>
        {sub ? (
          <Text style={{ fontSize: 14, lineHeight: 20, color: theme.textSecondary }}>{sub}</Text>
        ) : null}
      </View>
    </View>
  );
}

function renderVisual(visual: HelpVisual) {
  if (visual.type === 'dot') {
    return (
      <View
        style={{
          width: 12,
          height: 12,
          borderRadius: 6,
          backgroundColor: visual.color,
        }}
      />
    );
  }
  if (visual.type === 'line') {
    return (
      <View
        style={{
          width: 24,
          height: 6,
          borderRadius: 3,
          backgroundColor: visual.color,
        }}
      />
    );
  }
  if (visual.type === 'chip') {
    return (
      <Text style={{ fontSize: 11, fontWeight: '700', color: visual.color }}>{visual.text}</Text>
    );
  }
  if (visual.type === 'emoji') {
    return <Text style={{ fontSize: 16 }}>{visual.emoji}</Text>;
  }
  const badgeStyles =
    visual.variant === 'yes'
      ? { bg: colors.statusGoodBg, text: colors.statusGood, label: 'Yes to Park' }
      : visual.variant === 'caution'
        ? { bg: colors.statusCautionBg, text: colors.statusCaution, label: 'Caution' }
        : { bg: colors.statusAvoidBg, text: colors.statusAvoid, label: "Don't Park" };
  return (
    <View
      style={{
        borderRadius: 999,
        paddingHorizontal: 8,
        paddingVertical: 3,
        backgroundColor: badgeStyles.bg,
      }}
    >
      <Text style={{ fontSize: 10, fontWeight: '700', color: badgeStyles.text }}>{badgeStyles.label}</Text>
    </View>
  );
}
