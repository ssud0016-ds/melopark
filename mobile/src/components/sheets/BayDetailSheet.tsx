import { BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, sheetSnapPoints, SNAP_HALF, SNAP_FULL } from '../../design-system';
import { useThemeColors } from '../../hooks/useThemeColors';
import {
  fetchBayCarbon,
  fetchBayEvaluation,
  type AccessibilityBayRow,
  type Bay,
  type BayCarbon,
  type BayEvaluation,
} from '../../services/apiBays';
import type { Landmark } from '../../data/landmarks';
import { bayMissingStreetNote, streetShort } from '../../utils/bayLabels';
import {
  DEFAULT_PLANNER_DURATION_MINS,
  DURATION_FILTER_TO_MINS,
  durationFilterLabel,
  formatMelbourneDate,
  formatMelbourneTime,
  isFuturePlanningArrival,
} from '../../utils/plannerTime';

import { BayDetailNavActions } from '../bay/BayDetailNavActions';
import { FuturePlanningBanner } from '../bay/FuturePlanningBanner';
import { BayStatusAndLimits } from '../bay/BayStatusAndLimits';
import { ParkingSignTranslator } from '../bay/ParkingSignTranslator';
import { ParkingVerdictPanel, type VerdictVariant } from '../bay/ParkingVerdictPanel';
import { SustainabilityBadge } from '../bay/SustainabilityBadge';

const SNAP_FULL_INDEX = SNAP_FULL;

export type BayDetailSheetRef = {
  present: (bay: Bay) => void;
  dismiss: () => void;
  snapTo: (index: number) => void;
  getIndex: () => number;
};

type Props = {
  destination?: Landmark | null;
  durationFilter?: string | null;
  customDuration?: number | null;
  plannerArrivalIso?: string | null;
  plannerDurationMins?: number | null;
  accessibleRulesByBayId?: Record<string, AccessibilityBayRow>;
  onSheetIndexChange?: (index: number) => void;
  onTrapDetected?: (msg: string) => void;
};

export const BayDetailSheet = forwardRef<BayDetailSheetRef, Props>(
  (
    {
      destination = null,
      durationFilter = null,
      customDuration = null,
      plannerArrivalIso = null,
      plannerDurationMins = null,
      accessibleRulesByBayId = {},
      onSheetIndexChange,
      onTrapDetected,
    },
    ref,
  ) => {
    const theme = useThemeColors();
    const insets = useSafeAreaInsets();
    const sheetRef = useRef<BottomSheetModal>(null);
    const indexRef = useRef(-1);
    const [bay, setBay] = useState<Bay | null>(null);
    const [evaluation, setEvaluation] = useState<BayEvaluation | null>(null);
    const [carbon, setCarbon] = useState<BayCarbon | null>(null);
    const [loading, setLoading] = useState(false);
    const snaps = useMemo(() => [...sheetSnapPoints], []);
    const trapNotifiedRef = useRef<string | null>(null);
    const onTrapDetectedRef = useRef(onTrapDetected);
    useEffect(() => {
      onTrapDetectedRef.current = onTrapDetected;
    }, [onTrapDetected]);

    useImperativeHandle(ref, () => ({
      present: (b: Bay) => {
        setBay(b);
        trapNotifiedRef.current = null;
        sheetRef.current?.present();
      },
      dismiss: () => sheetRef.current?.dismiss(),
      snapTo: (i: number) => sheetRef.current?.snapToIndex(i),
      getIndex: () => indexRef.current,
    }));

    const fetchOpts = useMemo(() => {
      if (plannerArrivalIso && plannerDurationMins != null) {
        return { arrivalIso: plannerArrivalIso, durationMins: plannerDurationMins };
      }
      if (durationFilter) {
        const mins =
          durationFilter === 'custom' ? customDuration : DURATION_FILTER_TO_MINS[durationFilter];
        if (mins) return { arrivalIso: new Date().toISOString(), durationMins: mins };
      }
      return null;
    }, [plannerArrivalIso, plannerDurationMins, durationFilter, customDuration]);

    const accessibilityRuleFallback = bay?.id
      ? accessibleRulesByBayId[String(bay.id)] ?? null
      : null;

    const renderEvaluation = useMemo((): BayEvaluation | null => {
      if (loading && !evaluation) return null;
      if (evaluation?.translator_rules?.length) return evaluation;

      const plainEnglish = accessibilityRuleFallback?.plain_english;
      const typedesc = accessibilityRuleFallback?.typedesc;
      if (!plainEnglish && !typedesc) return evaluation;

      const heading = typedesc ? `Rule: ${typedesc}` : 'Accessible bay rule';
      const body = plainEnglish || 'Accessibility rule is available for this bay.';
      return {
        ...(evaluation || {
          bay_id: bay?.id ?? '',
          verdict: 'unknown',
          reason: '',
          data_source: 'unknown',
        }),
        active_restriction: {
          ...(evaluation?.active_restriction || {}),
          typedesc: typedesc || evaluation?.active_restriction?.typedesc || null,
          plain_english: plainEnglish || evaluation?.active_restriction?.plain_english || null,
          rule_category: evaluation?.active_restriction?.rule_category || 'disabled',
        },
        translator_rules: [
          {
            heading,
            body,
            state: 'current',
            banner: null,
          },
        ],
      } as BayEvaluation;
    }, [loading, evaluation, accessibilityRuleFallback, bay?.id]);

    useEffect(() => {
      if (!bay?.id) {
        setEvaluation(null);
        setCarbon(null);
        setLoading(false);
        return;
      }
      const bayId = bay.id;
      let cancelled = false;
      setLoading(true);
      setEvaluation(null);
      setCarbon(null);
      Promise.all([fetchBayEvaluation(bayId, fetchOpts), fetchBayCarbon(bayId)])
        .then(([ev, cb]) => {
          if (cancelled) return;
          setEvaluation(ev);
          setCarbon(cb);
          if (ev?.warning && trapNotifiedRef.current !== bayId) {
            trapNotifiedRef.current = bayId;
            onTrapDetectedRef.current?.(ev.warning.description);
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, [bay?.id, fetchOpts]);

    const isFuturePlanningMode = isFuturePlanningArrival(plannerArrivalIso);

    const isTowAwayOrLoading = ((): boolean => {
      const cat = (
        renderEvaluation?.warning?.type ||
        renderEvaluation?.active_restriction?.rule_category ||
        ''
      ).toLowerCase();
      return cat === 'clearway' || cat === 'loading' || cat === 'no_standing';
    })();

    const verdictVariant: VerdictVariant | null = ((): VerdictVariant | null => {
      if (!isFuturePlanningMode && bay?.free === 0) return 'no';
      if (!renderEvaluation || loading) return null;
      if (renderEvaluation.verdict === 'no') return 'no';
      if (renderEvaluation.verdict === 'yes' && renderEvaluation.warning && isTowAwayOrLoading)
        return 'caution';
      if (renderEvaluation.verdict === 'yes') return 'yes';
      return 'no';
    })();

    const permitOnly =
      (renderEvaluation?.warning?.type || '').toLowerCase() === 'disabled' ||
      (renderEvaluation?.active_restriction?.rule_category || '').toLowerCase() === 'disabled';

    const resolvedName = bay?.name?.trim() || renderEvaluation?.street_name || null;
    const missingStreetNote = resolvedName ? null : bayMissingStreetNote(bay);
    const streetLine = resolvedName ? streetShort(resolvedName) : null;

    const occupancyBadge = bay?.free === 1 ? 'FREE NOW' : bay?.free === 0 ? 'OCCUPIED NOW' : 'STATUS UNKNOWN';
    const occupancyDot =
      bay?.free === 1 ? colors.statusGood : bay?.free === 0 ? colors.statusAvoid : colors.statusUnknown;

    const showingIso = useMemo(
      () => plannerArrivalIso ?? new Date().toISOString(),
      [plannerArrivalIso, bay?.id],
    );
    const showingDate = formatMelbourneDate(showingIso);
    const showingTime = formatMelbourneTime(showingIso);
    const durationLabel = durationFilterLabel(durationFilter ?? null, customDuration ?? null);
    const durationMins = plannerDurationMins ?? DEFAULT_PLANNER_DURATION_MINS;

    return (
      <BottomSheetModal
        ref={sheetRef}
        snapPoints={snaps}
        index={SNAP_HALF}
        enableDynamicSizing={false}
        backgroundStyle={{ backgroundColor: theme.sheet }}
        handleIndicatorStyle={{ backgroundColor: theme.handle, width: 32, height: 4 }}
        onChange={(i) => {
          indexRef.current = i;
          onSheetIndexChange?.(i);
        }}
        onDismiss={() => {
          indexRef.current = -1;
          onSheetIndexChange?.(-1);
        }}
        accessibilityLabel={bay ? `Bay ${bay.id} details` : 'Bay details'}
        activeOffsetY={[-1, 1]}
        enableOverDrag={false}
      >
        <View style={{ flex: 1 }}>
        <BottomSheetScrollView
          stickyHeaderIndices={[0]}
          contentContainerStyle={{ paddingBottom: 16 }}
          style={{ flex: 1 }}
        >
          {/* Sticky header — in scroll tree so verdict card is not clipped underneath */}
          <View
            style={{
              backgroundColor: theme.sheet,
              paddingHorizontal: 20,
              paddingTop: 8,
              paddingBottom: 14,
              borderBottomWidth: 0.5,
              borderBottomColor: theme.border,
              gap: 6,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <Text
                numberOfLines={1}
                style={{
                  flex: 1,
                  flexShrink: 1,
                  fontSize: 12,
                  fontWeight: '700',
                  color: theme.textMuted,
                  letterSpacing: 1,
                  marginRight: 8,
                }}
              >
                {bay ? `BAY #${bay.id}` : 'BAY'}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: occupancyDot }} />
                  <Text
                    numberOfLines={1}
                    style={{ fontSize: 10, fontWeight: '700', color: theme.textMuted, letterSpacing: 0.8 }}
                  >
                    {occupancyBadge}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close bay details"
                  onPress={() => sheetRef.current?.dismiss()}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: theme.chromeMuted,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  hitSlop={6}
                >
                  <Text style={{ fontSize: 18, color: theme.text, lineHeight: 20 }}>×</Text>
                </Pressable>
              </View>
            </View>
            {streetLine ? (
              <Text numberOfLines={2} style={{ fontSize: 14, fontWeight: '600', color: theme.text, lineHeight: 20 }}>
                {streetLine}
              </Text>
            ) : missingStreetNote ? (
              <Text style={{ fontSize: 14, fontWeight: '500', color: theme.textSecondary, lineHeight: 20 }}>
                {missingStreetNote}
              </Text>
            ) : null}
            <Text numberOfLines={2} style={{ fontSize: 12, lineHeight: 18, color: theme.textSecondary }}>
              <Text style={{ fontWeight: '600' }}>Showing: </Text>
              <Text style={{ fontWeight: '600', color: theme.tabActive }}>{durationLabel}</Text>
              <Text> · </Text>
              <Text style={{ fontWeight: '600', color: theme.tabActive }}>
                {showingDate} {showingTime}
              </Text>
            </Text>
          </View>

          {isFuturePlanningMode ? <FuturePlanningBanner /> : null}

          {/* Disability permit banner */}
          {permitOnly ? (
            <View
              style={{
                marginHorizontal: 20,
                marginTop: 12,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: theme.border,
                backgroundColor: theme.chromeMuted,
                paddingHorizontal: 14,
                paddingVertical: 10,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Text style={{ fontSize: 14 }}>♿</Text>
              <Text style={{ fontSize: 12, fontWeight: '700', color: theme.tabActive, letterSpacing: 1 }}>
                DISABILITY PERMIT HOLDERS ONLY
              </Text>
            </View>
          ) : null}

          {loading && !evaluation ? (
            <View style={{ paddingHorizontal: 20, paddingVertical: 24 }}>
              <ActivityIndicator color={colors.brand} />
            </View>
          ) : (
            <>
              {verdictVariant ? (
                <ParkingVerdictPanel
                  variant={verdictVariant}
                  durationMins={durationMins}
                  evaluation={renderEvaluation}
                />
              ) : null}

              <BayStatusAndLimits bay={bay} evaluation={renderEvaluation} />

              <ParkingSignTranslator evaluation={renderEvaluation} />

              <View style={{ paddingHorizontal: 20, paddingBottom: 20 }}>
                <SustainabilityBadge carbonData={carbon} />
              </View>
            </>
          )}
        </BottomSheetScrollView>

        <View
          style={{
            borderTopWidth: 0.5,
            borderTopColor: theme.border,
            backgroundColor: theme.sheet,
            paddingBottom: Math.max(insets.bottom, 8),
          }}
        >
          <BayDetailNavActions bay={bay} destination={destination} />
        </View>
        </View>
      </BottomSheetModal>
    );
  },
);
BayDetailSheet.displayName = 'BayDetailSheet';

export { SNAP_FULL_INDEX };
