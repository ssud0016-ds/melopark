import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { colors } from '../../design-system';
import { fetchSegmentDetail } from '../../services/apiPressure';

const SNAP_POINTS = ['35%'];

export type SegmentDetailSheetRef = {
  present: (segmentId: string) => void;
  dismiss: () => void;
};

type SegmentDetail = {
  segment_id: string;
  street_name?: string;
  seg_descr?: string;
  occ_pct?: number;
  free?: number;
  total?: number;
  level?: 'low' | 'medium' | 'high' | 'critical';
  pressure?: number;
  trend?: string;
};

export const SegmentDetailSheet = forwardRef<SegmentDetailSheetRef>((_props, ref) => {
  const sheetRef = useRef<BottomSheetModal>(null);
  const [segmentId, setSegmentId] = useState<string | null>(null);
  const [detail, setDetail] = useState<SegmentDetail | null>(null);
  const [loading, setLoading] = useState(false);

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
    fetchSegmentDetail(segmentId)
      .then((d) => {
        if (!cancelled) setDetail(d as SegmentDetail);
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
  }, [segmentId]);

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={SNAP_POINTS}
      enableDynamicSizing={false}
      backgroundStyle={{ backgroundColor: colors.surface }}
      handleIndicatorStyle={{ backgroundColor: colors.surfaceDarkTertiary }}
    >
      <BottomSheetView style={{ flex: 1, padding: 20 }}>
        {loading ? (
          <ActivityIndicator color={colors.brand} />
        ) : detail ? (
          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 11, fontWeight: '500', color: colors.brand, textTransform: 'uppercase' }}>
              Busy now
            </Text>
            <Text style={{ fontSize: 20, fontWeight: '700', color: colors.surfaceDark }}>
              {detail.street_name ?? `Segment ${detail.segment_id}`}
            </Text>
            {detail.seg_descr ? (
              <Text style={{ fontSize: 12, color: colors.surfaceDarkTertiary }}>{detail.seg_descr}</Text>
            ) : null}
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
              <Stat label="Level" value={detail.level ?? '—'} />
              <Stat label="Free" value={`${detail.free ?? 0}/${detail.total ?? 0}`} />
              <Stat label="Pressure" value={detail.pressure != null ? `${Math.round(detail.pressure * 100)}%` : '—'} />
              <Stat label="Trend" value={detail.trend ?? '—'} />
            </View>
          </View>
        ) : (
          <Text style={{ color: colors.surfaceDarkTertiary }}>Segment detail unavailable.</Text>
        )}
      </BottomSheetView>
    </BottomSheetModal>
  );
});
SegmentDetailSheet.displayName = 'SegmentDetailSheet';

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Text style={{ fontSize: 10, fontWeight: '500', color: colors.surfaceDarkTertiary, textTransform: 'uppercase' }}>
        {label}
      </Text>
      <Text style={{ fontSize: 14, fontWeight: '600', color: colors.surfaceDark }}>{value}</Text>
    </View>
  );
}
