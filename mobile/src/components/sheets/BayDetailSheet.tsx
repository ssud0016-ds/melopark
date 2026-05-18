import { BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { colors, haptics, statusColor } from '../../design-system';
import {
  fetchBayCarbon,
  fetchBayEvaluation,
  type BayCarbon,
  type BayEvaluation,
} from '../../services/apiBays';

const SNAP_POINTS = ['15%', '50%', '75%'];
const SNAP_FULL_INDEX = 2;

export type BayDetailSheetRef = {
  present: (bayId: string) => void;
  dismiss: () => void;
  snapTo: (index: number) => void;
  getIndex: () => number;
};

type Props = {
  onNavigateCta?: (bayId: string) => void;
  onWalkCta?: (bayId: string) => void;
  onSheetIndexChange?: (index: number) => void;
  colorBlindMode?: boolean;
};

type Chip = { label: string; tone: 'neutral' | 'good' | 'warn' | 'bad' };
type ProofRow = { label: string; value: string };

export function buildBayDetailModel(evaluation: BayEvaluation | null, carbon: BayCarbon | null) {
  const restriction = evaluation?.active_restriction ?? null;
  const chips: Chip[] = [];
  const proofRows: ProofRow[] = [];

  if (evaluation?.verdict) {
    chips.push({
      label: verdictLabel(evaluation.verdict),
      tone:
        evaluation.verdict === 'yes' ? 'good' : evaluation.verdict === 'no' ? 'bad' : 'neutral',
    });
  }
  if (restriction?.max_stay_mins != null) {
    chips.push({ label: `${restriction.max_stay_mins} min max`, tone: 'neutral' });
  }
  if (restriction?.rule_category) {
    chips.push({ label: restriction.rule_category, tone: 'neutral' });
  }
  if (evaluation?.warning) {
    chips.push({ label: 'Warning', tone: 'warn' });
  }

  if (evaluation?.data_source) proofRows.push({ label: 'Rule source', value: evaluation.data_source });
  if (restriction?.typedesc) proofRows.push({ label: 'Matched rule', value: restriction.typedesc });
  if (restriction?.expires_at) proofRows.push({ label: 'Window ends', value: formatTime(restriction.expires_at) });
  if (carbon) proofRows.push({ label: 'Carbon score', value: String(carbon.score) });

  return {
    restriction,
    chips,
    proofRows,
    hasTimeline: Boolean(restriction?.expires_at),
  };
}

export const BayDetailSheet = forwardRef<BayDetailSheetRef, Props>(
  ({ onNavigateCta, onWalkCta, onSheetIndexChange, colorBlindMode = false }, ref) => {
    const sheetRef = useRef<BottomSheetModal>(null);
    const indexRef = useRef(-1);
    const [bayId, setBayId] = useState<string | null>(null);
    const [evaluation, setEvaluation] = useState<BayEvaluation | null>(null);
    const [carbon, setCarbon] = useState<BayCarbon | null>(null);
    const [loading, setLoading] = useState(false);

    useImperativeHandle(ref, () => ({
      present: (id: string) => {
        setBayId(id);
        sheetRef.current?.present();
      },
      dismiss: () => sheetRef.current?.dismiss(),
      snapTo: (i: number) => sheetRef.current?.snapToIndex(i),
      getIndex: () => indexRef.current,
    }));

    useEffect(() => {
      if (!bayId) return;
      let cancelled = false;
      setLoading(true);
      setEvaluation(null);
      setCarbon(null);
      Promise.all([fetchBayEvaluation(bayId), fetchBayCarbon(bayId)])
        .then(([ev, cb]) => {
          if (cancelled) return;
          setEvaluation(ev);
          setCarbon(cb);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, [bayId]);

    const model = useMemo(() => buildBayDetailModel(evaluation, carbon), [evaluation, carbon]);
    const verdictColor = verdictStatusColor(evaluation?.verdict, colorBlindMode);

    return (
      <BottomSheetModal
        ref={sheetRef}
        snapPoints={SNAP_POINTS}
        enableDynamicSizing={false}
        backgroundStyle={{ backgroundColor: colors.surface }}
        handleIndicatorStyle={{ backgroundColor: colors.surfaceDarkTertiary }}
        onChange={(i) => {
          indexRef.current = i;
          onSheetIndexChange?.(i);
        }}
        onDismiss={() => {
          indexRef.current = -1;
          onSheetIndexChange?.(-1);
        }}
      >
        <BottomSheetScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
          <View style={{ gap: 4 }}>
            <Text style={styles.eyebrow}>Bay</Text>
            <Text style={styles.title}>{bayId ? `Bay ${bayId}` : 'Loading...'}</Text>
          </View>

          {loading ? (
            <ActivityIndicator color={colors.brand} />
          ) : evaluation ? (
            <>
              <VerdictCard
                verdict={evaluation.verdict}
                reason={evaluation.reason}
                color={verdictColor}
              />

              {model.chips.length > 0 ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {model.chips.map((chip) => (
                    <Chip key={chip.label} chip={chip} colorBlindMode={colorBlindMode} />
                  ))}
                </View>
              ) : null}

              <Card title="Parking limits">
                <DetailRow
                  label="Status"
                  value={verdictLabel(evaluation.verdict)}
                  valueColor={verdictColor}
                />
                <DetailRow
                  label="Maximum stay"
                  value={
                    model.restriction?.max_stay_mins != null
                      ? `${model.restriction.max_stay_mins} min`
                      : 'No active limit returned'
                  }
                />
              </Card>

              <Card title="Restriction summary">
                {model.restriction ? (
                  <>
                    <Text style={styles.cardPrimary}>{model.restriction.typedesc}</Text>
                    <Text style={styles.cardSecondary}>{model.restriction.plain_english}</Text>
                  </>
                ) : (
                  <FallbackNotice
                    message="No active restriction was returned for this bay right now."
                    colorBlindMode={colorBlindMode}
                  />
                )}
              </Card>

              {evaluation.warning ? (
                <Card title="Notice" tint={colors.statusCautionBg}>
                  <Text style={styles.cardSecondary}>{evaluation.warning.description}</Text>
                </Card>
              ) : null}

              {model.hasTimeline && model.restriction?.expires_at ? (
                <Card title="Current window">
                  <TimelineStrip
                    expiresAt={model.restriction.expires_at}
                    colorBlindMode={colorBlindMode}
                  />
                </Card>
              ) : null}

              {model.proofRows.length > 0 ? (
                <Card title="Evidence">
                  {model.proofRows.map((row) => (
                    <DetailRow key={row.label} label={row.label} value={row.value} />
                  ))}
                </Card>
              ) : null}

              {carbon ? (
                <Card title="Carbon savings">
                  <DetailRow label="Score" value={String(carbon.score)} />
                  <Text style={styles.cardSecondary}>
                    ~{Math.round(carbon.saved_g)} g CO2 saved -{' '}
                    {Math.round(carbon.pct_avoided * 100)}% avoided
                  </Text>
                </Card>
              ) : null}
            </>
          ) : (
            <FallbackNotice
              message="Rule and evaluation data is unavailable for this bay. You can still navigate to the bay location."
              colorBlindMode={colorBlindMode}
            />
          )}

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <ActionButton
              label="Navigate"
              disabled={!bayId}
              primary
              onPress={() => {
                if (!bayId) return;
                haptics.medium();
                onNavigateCta?.(bayId);
              }}
            />
            <ActionButton
              label="Walk"
              disabled={!bayId || !onWalkCta}
              onPress={() => {
                if (!bayId) return;
                haptics.medium();
                onWalkCta?.(bayId);
              }}
            />
          </View>
        </BottomSheetScrollView>
      </BottomSheetModal>
    );
  },
);
BayDetailSheet.displayName = 'BayDetailSheet';

export { SNAP_FULL_INDEX };

const styles = {
  eyebrow: {
    fontSize: 11,
    fontWeight: '500' as const,
    color: colors.brand,
    textTransform: 'uppercase' as const,
  },
  title: { fontSize: 20, fontWeight: '700' as const, color: colors.surfaceDark },
  cardPrimary: { fontSize: 14, fontWeight: '600' as const, color: colors.surfaceDark },
  cardSecondary: { fontSize: 12, color: colors.surfaceDarkTertiary },
};

function verdictLabel(verdict: BayEvaluation['verdict']) {
  return verdict === 'yes' ? 'OK to park' : verdict === 'no' ? 'Avoid' : 'Unknown';
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function VerdictCard({
  verdict,
  reason,
  color,
}: {
  verdict: BayEvaluation['verdict'];
  reason: string;
  color: string;
}) {
  return (
    <View
      style={{
        gap: 6,
        padding: 16,
        borderRadius: 14,
        backgroundColor: colors.surfaceTertiary,
        borderLeftWidth: 4,
        borderLeftColor: color,
      }}
    >
      <Text style={{ fontSize: 16, fontWeight: '700', color }}>{verdictLabel(verdict)}</Text>
      <Text style={{ fontSize: 13, color: colors.surfaceDark }}>{reason}</Text>
    </View>
  );
}

export function verdictStatusColor(
  verdict: BayEvaluation['verdict'] | undefined,
  colorBlindMode = false,
) {
  if (verdict === 'yes') return statusColor('good', colorBlindMode);
  if (verdict === 'no') return statusColor('avoid', colorBlindMode);
  return statusColor('unknown', colorBlindMode);
}

function Chip({ chip, colorBlindMode }: { chip: Chip; colorBlindMode: boolean }) {
  const tint =
    chip.tone === 'good'
      ? statusColor('good', colorBlindMode)
      : chip.tone === 'bad'
        ? statusColor('avoid', colorBlindMode)
        : chip.tone === 'warn'
          ? statusColor('caution', colorBlindMode)
          : colors.brand;

  return (
    <View
      style={{
        minHeight: 32,
        borderRadius: 16,
        paddingHorizontal: 12,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.surfaceTertiary,
        borderWidth: 1,
        borderColor: tint,
      }}
    >
      <Text style={{ color: tint, fontSize: 12, fontWeight: '600' }}>{chip.label}</Text>
    </View>
  );
}

function TimelineStrip({
  expiresAt,
  colorBlindMode,
}: {
  expiresAt: string;
  colorBlindMode: boolean;
}) {
  return (
    <View style={{ gap: 8 }}>
      <View
        style={{
          height: 8,
          borderRadius: 4,
          backgroundColor: statusColor('caution', colorBlindMode),
        }}
      />
      <DetailRow label="Active until" value={formatTime(expiresAt)} />
    </View>
  );
}

function DetailRow({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
      <Text style={{ flex: 1, fontSize: 12, color: colors.surfaceDarkTertiary }}>{label}</Text>
      <Text
        style={{
          flex: 1,
          textAlign: 'right',
          fontSize: 12,
          fontWeight: '600',
          color: valueColor ?? colors.surfaceDark,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function FallbackNotice({
  message,
  colorBlindMode,
}: {
  message: string;
  colorBlindMode: boolean;
}) {
  return (
    <View
      style={{
        padding: 12,
        borderRadius: 12,
        backgroundColor: colors.surfaceTertiary,
        borderWidth: 1,
        borderColor: statusColor('unknown', colorBlindMode),
      }}
    >
      <Text style={{ fontSize: 12, color: colors.surfaceDarkTertiary }}>{message}</Text>
    </View>
  );
}

function ActionButton({
  label,
  disabled,
  primary,
  onPress,
}: {
  label: string;
  disabled?: boolean;
  primary?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={{
        minHeight: 48,
        flex: 1,
        borderRadius: 12,
        backgroundColor: primary ? colors.brand : colors.surfaceTertiary,
        borderWidth: primary ? 0 : 1,
        borderColor: colors.brand,
        opacity: disabled ? 0.5 : 1,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: primary ? colors.surface : colors.brand, fontWeight: '600' }}>
        {label}
      </Text>
    </Pressable>
  );
}

function Card({
  title,
  children,
  tint,
}: {
  title: string;
  children: React.ReactNode;
  tint?: string;
}) {
  return (
    <View
      style={{
        gap: 8,
        padding: 14,
        borderRadius: 12,
        backgroundColor: tint ?? colors.surfaceTertiary,
      }}
    >
      <Text
        style={{
          fontSize: 10,
          fontWeight: '500',
          color: colors.surfaceDarkTertiary,
          textTransform: 'uppercase',
        }}
      >
        {title}
      </Text>
      {children}
    </View>
  );
}
