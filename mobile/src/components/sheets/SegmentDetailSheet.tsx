import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { EventBadge } from '../busyNow/EventBadge';
import { colors } from '../../design-system';
import { useThemeColors } from '../../hooks/useThemeColors';
import { fetchSegmentDetail, type PressureManifest } from '../../services/apiPressure';
import { segmentDetailFromApi, type SegmentPopupDetail } from '../../utils/segmentDetailFromApi';
import {
  coverageText,
  formatChanceLine,
  formatWhyLine,
  pressureSignalPct,
  statusDotColor,
} from '../../utils/segmentPopup';

const SNAP_POINTS = ['40%'];

export type SegmentDetailSheetRef = {
  present: (segmentId: string) => void;
  dismiss: () => void;
};

type Props = {
  manifest?: PressureManifest | null;
  colorBlindMode?: boolean;
};

export const SegmentDetailSheet = forwardRef<SegmentDetailSheetRef, Props>(
  ({ manifest = null, colorBlindMode = false }, ref) => {
    const sheetRef = useRef<BottomSheetModal>(null);
    const [segmentId, setSegmentId] = useState<string | null>(null);
    const [detail, setDetail] = useState<SegmentPopupDetail | null>(null);
    const [loading, setLoading] = useState(false);
    const theme = useThemeColors();

    const dataVersion = manifest?.data_version ?? manifest?.minute_bucket ?? null;

    useImperativeHandle(ref, () => ({
      present: (id: string) => {
        setSegmentId(id);
        sheetRef.current?.present();
      },
      dismiss: () => sheetRef.current?.dismiss(),
    }));

    useEffect(() => {
      if (!segmentId) return;
      let cancelled = false;
      setLoading(true);
      setDetail(null);
      fetchSegmentDetail(segmentId, { dataVersion })
        .then((api) => {
          if (!cancelled) setDetail(segmentDetailFromApi(api));
        })
        .catch(() => {
          if (!cancelled) setDetail(null);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, [segmentId, dataVersion]);

    return (
      <BottomSheetModal
        ref={sheetRef}
        snapPoints={SNAP_POINTS}
        enableDynamicSizing={false}
        backgroundStyle={{ backgroundColor: theme.sheet }}
        handleIndicatorStyle={{ backgroundColor: theme.handle }}
      >
        <BottomSheetView style={{ flex: 1, padding: 20, paddingBottom: 32 }}>
          {loading ? (
            <ActivityIndicator color={colors.brand} />
          ) : detail ? (
            <SegmentPopupContent detail={detail} colorBlindMode={colorBlindMode} />
          ) : (
            <Text style={{ color: theme.textSecondary }}>Segment detail unavailable.</Text>
          )}
        </BottomSheetView>
      </BottomSheetModal>
    );
  },
);
SegmentDetailSheet.displayName = 'SegmentDetailSheet';

function SegmentPopupContent({
  detail,
  colorBlindMode,
}: {
  detail: SegmentPopupDetail;
  colorBlindMode: boolean;
}) {
  const theme = useThemeColors();
  const dot = statusDotColor(detail.level, colorBlindMode);
  const { chanceText, occSuffix, trendLabel, trendAria } = formatChanceLine(detail);
  const whyLine = formatWhyLine(detail);
  const coverage = coverageText(detail.total_bays, detail.has_live_bays);
  const pct = pressureSignalPct(detail);
  const events = detail.events ?? detail.events_nearby ?? [];

  return (
    <View accessibilityRole="summary" accessibilityLabel="Street parking chance detail">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: dot,
          }}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
        <Text
          style={{ flex: 1, fontSize: 14, fontWeight: '600', color: theme.text }}
          numberOfLines={2}
        >
          {detail.street_name || 'Street segment'}
        </Text>
      </View>

      {detail.seg_descr ? (
        <Text style={{ fontSize: 11, color: theme.textSecondary, marginBottom: 4 }}>
          {detail.seg_descr}
        </Text>
      ) : null}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }}>
        <Text style={{ fontSize: 11, fontWeight: '500', color: theme.text }}>
          {chanceText}
          {occSuffix}
        </Text>
        {trendLabel ? (
          <Text
            style={{ fontSize: 11, fontWeight: '500', color: theme.text }}
            accessibilityLabel={trendAria}
          >
            {` ${trendLabel}`}
          </Text>
        ) : null}
      </View>

      {(detail.total_bays ?? 0) > 0 && detail.has_live_bays ? (
        <Text style={{ fontSize: 11, color: theme.textSecondary, marginTop: 2 }}>
          {detail.free_bays} of {detail.total_bays} bays free
        </Text>
      ) : null}

      <Text style={{ fontSize: 11, color: theme.textSecondary, marginTop: 2 }}>
        {coverage}
        {pct != null ? ` · ${pct}% pressure signal` : ''}
      </Text>

      {whyLine ? (
        <Text
          style={{ fontSize: 11, color: theme.textSecondary, marginTop: 4 }}
          accessibilityLabel={whyLine.replace(/^Why: /, '')}
        >
          {whyLine}
        </Text>
      ) : null}

      <EventBadge events={events} />
    </View>
  );
}
