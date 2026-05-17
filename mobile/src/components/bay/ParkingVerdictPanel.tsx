import { Text, View } from 'react-native';

import type { BayEvaluation } from '../../services/apiBays';
import { formatLeaveByClock, formatStayLimitShort } from '../../utils/plannerTime';

export type VerdictVariant = 'yes' | 'no' | 'caution';

type Props = {
  variant: VerdictVariant;
  durationMins: number;
  evaluation: BayEvaluation | null;
};

const TONE_BG: Record<'yes' | 'no' | 'caution' | 'permit', string> = {
  yes: '#CFF57A',
  no: '#F59A9A',
  caution: '#F7B38A',
  permit: '#F7B38A',
};
const INK = '#263089';

function ruleLabelFromType(type?: string | null): string | null {
  const t = (type || '').toLowerCase();
  if (t === 'clearway') return 'Tow-Away Zone';
  if (t === 'no_standing') return 'No Standing';
  if (t === 'loading') return 'Loading Zone';
  if (t === 'disabled') return 'Disability Permit Only';
  return null;
}

function durationLabel(durationMins: number): string | null {
  if (!Number.isFinite(durationMins) || durationMins <= 0) return null;
  if (durationMins % 60 === 0 && durationMins <= 6 * 60) return `${durationMins / 60}P`;
  if (durationMins >= 60) return `${Math.floor(durationMins / 60)}h ${durationMins % 60}m`.replace(' 0m', '');
  return `${durationMins}m`;
}

export function ParkingVerdictPanel({ variant, durationMins, evaluation }: Props) {
  const restriction = evaluation?.active_restriction ?? null;
  const warning = evaluation?.warning ?? null;
  const permitOnly =
    (warning?.type || '').toLowerCase() === 'disabled' ||
    (restriction?.rule_category || '').toLowerCase() === 'disabled';

  const translatorRules = evaluation?.translator_rules ?? [];
  const currentRule = translatorRules.find((r) => r.state === 'current') ?? null;
  const outsideRule = translatorRules.find((r) => r.state === 'outside') ?? null;
  const noPayment =
    restriction?.rule_category === 'free' ||
    (!currentRule && !!outsideRule) ||
    /(no\s+payment|no\s+limit\s+and\s+no\s+payment)/i.test(currentRule?.body || '');
  const paymentRequired = !evaluation ? null : noPayment ? 'No' : 'Yes';

  const stayLimit =
    restriction?.max_stay_mins != null
      ? formatStayLimitShort(restriction.max_stay_mins) ?? `${restriction.max_stay_mins} min`
      : null;

  const leaveBy =
    formatLeaveByClock(restriction?.expires_at) ||
    formatLeaveByClock(warning?.starts_at) ||
    null;

  const warningMinutes = warning?.minutes_into_stay ?? null;
  const requested = durationLabel(durationMins);

  const tone = permitOnly ? 'permit' : variant;
  const word = permitOnly ? 'PERMIT' : variant === 'yes' ? 'YES' : variant === 'no' ? 'NO' : 'Caution';
  const sentence = permitOnly
    ? 'Disability permit required to park here'
    : variant === 'yes'
      ? 'You can park here'
      : variant === 'no'
        ? 'You cannot park here'
        : 'You cannot park here fully';

  const showRestrictionRow = variant === 'caution';
  const restrictionValue =
    ruleLabelFromType(warning?.type) ||
    ruleLabelFromType(restriction?.rule_category) ||
    warning?.typedesc ||
    restriction?.typedesc ||
    null;

  const cautionBody =
    warning?.description ||
    (warningMinutes != null && requested
      ? `This bay is okay at first, but restrictions start about ${warningMinutes} minutes into your ${requested} stay.`
      : null);

  const noBody = ((): string | null => {
    if (!evaluation) return null;
    if (permitOnly) {
      return (
        restriction?.plain_english ||
        warning?.description ||
        'This bay is reserved for drivers displaying a valid disability parking permit.'
      );
    }
    const hasTranslator = Array.isArray(evaluation.translator_rules) && evaluation.translator_rules.length > 0;
    if (hasTranslator) return null;
    if (variant === 'no' && evaluation.verdict === 'no' && restriction?.max_stay_mins != null) {
      if (durationMins > restriction.max_stay_mins) {
        const hrs =
          restriction.max_stay_mins % 60 === 0
            ? `${restriction.max_stay_mins / 60} hours`
            : `${restriction.max_stay_mins} minutes`;
        const req = requested ? requested.replace('P', ' hours').replace('h', ' hours') : `${durationMins} minutes`;
        return `This parking spot only allows ${hrs} of parking. You are currently looking for ${req} of parking`;
      }
    }
    if (variant === 'no' && evaluation.reason) return evaluation.reason;
    return null;
  })();

  const trustNote = ((): string | null => {
    const source = evaluation?.data_source;
    if (source === 'api_fallback') return 'Rule estimate from external category data. Check street sign.';
    if (source === 'unknown') return 'No reliable restriction data for this bay. Check street sign.';
    return null;
  })();

  const showBody = (variant === 'caution' || variant === 'no') && (cautionBody || noBody);

  return (
    <View
      style={{
        marginHorizontal: 20,
        marginTop: 12,
        borderRadius: 16,
        padding: 20,
        backgroundColor: TONE_BG[tone],
      }}
    >
      <View style={{ flexDirection: permitOnly ? 'column' : 'row', alignItems: permitOnly ? 'flex-start' : 'baseline', gap: 12 }}>
        <Text style={{ fontSize: 44, fontWeight: '800', color: INK, letterSpacing: -0.5 }}>{word}</Text>
        <Text style={{ fontSize: 14, fontWeight: '600', color: INK, flexShrink: 1 }}>{sentence}</Text>
      </View>

      {trustNote ? (
        <View style={{ marginTop: 10, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.35)' }}>
          <Text style={{ fontSize: 11, fontWeight: '600', color: INK }}>{trustNote}</Text>
        </View>
      ) : null}

      <View style={{ height: 1, backgroundColor: 'rgba(38,48,137,0.2)', marginTop: 14 }} />

      <View style={{ marginTop: 12, gap: 10 }}>
        {showRestrictionRow ? (
          <Row label="Parking Restriction:" value={restrictionValue || 'Restriction'} />
        ) : null}
        {paymentRequired ? (
          <Row label={permitOnly ? 'Permit Required:' : 'Payment Required:'} value={paymentRequired} />
        ) : null}
        {stayLimit ? <Row label="Stay Limit:" value={stayLimit} /> : null}
        {leaveBy ? <Row label="Leave By:" value={leaveBy} /> : null}
      </View>

      {showBody ? (
        <View style={{ marginTop: 14, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: 'rgba(255,255,255,0.3)' }}>
          <Text style={{ fontSize: 12, lineHeight: 18, color: INK }}>
            {variant === 'caution' ? cautionBody : noBody}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
      <Text style={{ fontSize: 14, fontWeight: '600', color: INK }}>{label}</Text>
      <Text style={{ fontSize: 14, fontWeight: '600', color: INK }}>{value}</Text>
    </View>
  );
}
