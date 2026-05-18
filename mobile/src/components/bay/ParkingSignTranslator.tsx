import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { colors } from '../../design-system';
import { useThemeColors, type ThemeColors } from '../../hooks/useThemeColors';
import type { BayEvaluation, TranslatorRule } from '../../services/apiBays';

type Props = { evaluation: BayEvaluation | null };

const DAY_SHORT: Record<string, string> = {
  Sunday: 'Sun',
  Monday: 'Mon',
  Tuesday: 'Tue',
  Wednesday: 'Wed',
  Thursday: 'Thu',
  Friday: 'Fri',
  Saturday: 'Sat',
};

type RuleTone = 'now-active' | 'now-free' | 'next' | 'normal';

function toneBg(tone: RuleTone, theme: ThemeColors): string {
  switch (tone) {
    case 'now-active':
      return theme.statusGoodBg;
    case 'now-free':
      return theme.chromeMuted;
    case 'next':
      return theme.statusCautionBg;
    default:
      return theme.chrome;
  }
}

function toneBorder(tone: RuleTone, theme: ThemeColors): string {
  switch (tone) {
    case 'now-active':
      return theme.liveChipText;
    case 'now-free':
      return theme.tabActive;
    case 'next':
      return colors.statusCaution;
    default:
      return theme.border;
  }
}
const TONE_BADGE_BG: Record<Exclude<RuleTone, 'normal'>, string> = {
  'now-active': '#059669',
  'now-free': '#4f46e5',
  next: '#d97706',
};
const TONE_BADGE_LABEL: Record<Exclude<RuleTone, 'normal'>, string> = {
  'now-active': 'In effect',
  'now-free': 'Free now',
  next: 'Up next',
};

function condenseTime(s: string): string {
  if (!s) return s;
  return s.replace(/(\d{1,2}):00\s+(AM|PM)/, '$1 $2').trim();
}

function condenseHeading(heading: string | null | undefined): { isOutside?: boolean; days?: string; window?: string } | null {
  if (!heading) return null;
  if (/^outside/i.test(heading)) return { isOutside: true };
  const range = heading.match(/^(\w+) to (\w+) from (.+?) to (.+)$/);
  if (range) {
    return {
      days: `${DAY_SHORT[range[1]] || range[1]}-${DAY_SHORT[range[2]] || range[2]}`,
      window: `${condenseTime(range[3])}-${condenseTime(range[4])}`,
    };
  }
  const single = heading.match(/^(\w+) from (.+?) to (.+)$/);
  if (single) {
    return {
      days: DAY_SHORT[single[1]] || single[1],
      window: `${condenseTime(single[2])}-${condenseTime(single[3])}`,
    };
  }
  return { days: heading, window: '' };
}

function sanitizeRuleBody(body: string | null | undefined): string {
  const raw = (body || '').trim();
  if (!raw) return raw;
  const sentences = raw.split(/(?<=[.!?])\s+/);
  const kept = sentences.filter(
    (s) => !/(?:\bfines?\b|\bpenalt(?:y|ies)\b|\binfringements?\b|\bfined\b|\bpenalized\b)/i.test(s),
  );
  return (
    kept
      .join(' ')
      .replace(/\s*[,;:-]?\s*(?:fines?|penalt(?:y|ies)|infringements?)\s+(?:may\s+)?apply\.?/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim() || raw
  );
}

function ruleKey(r: TranslatorRule): string {
  return `${r.heading}::${r.body}`;
}

function isStrictRule(rule: TranslatorRule | null | undefined): boolean {
  if (!rule) return false;
  const text = `${rule.heading || ''} ${rule.body || ''}`;
  return /(tow[\s-]?away|clearway|no\s+stopping|loading\s*zone|permit\s+only|disabled)/i.test(text);
}

function RuleChip({
  rule,
  tone,
  isOpen,
  onToggle,
  theme,
}: {
  rule: TranslatorRule;
  tone: RuleTone;
  isOpen: boolean;
  onToggle: () => void;
  theme: ThemeColors;
}) {
  const cleanBody = sanitizeRuleBody(rule.body);
  const cond = condenseHeading(rule.heading);
  const isOutside = cond?.isOutside;

  const badgeLabel = tone !== 'normal' ? TONE_BADGE_LABEL[tone] : null;
  const badgeBg = tone !== 'normal' ? TONE_BADGE_BG[tone] : null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded: isOpen }}
      onPress={onToggle}
      style={{
        width: '100%',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: toneBorder(tone, theme),
        backgroundColor: toneBg(tone, theme),
        paddingHorizontal: 12,
        paddingVertical: 10,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {badgeLabel ? (
          <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999, backgroundColor: badgeBg ?? undefined }}>
            <Text style={{ fontSize: 9, fontWeight: '700', color: colors.surface, letterSpacing: 0.5 }}>
              {badgeLabel.toUpperCase()}
            </Text>
          </View>
        ) : null}
        <Text
          numberOfLines={1}
          style={{ flex: 1, fontSize: 12, fontWeight: '600', color: theme.text }}
        >
          {isOutside ? (
            <>No restrictions <Text style={{ opacity: 0.7 }}>· free, no payment</Text></>
          ) : (
            <>
              {cond?.days}
              {cond?.window ? <Text style={{ opacity: 0.7 }}> · {cond.window}</Text> : null}
            </>
          )}
        </Text>
        <Text style={{ fontSize: 10, color: theme.textMuted }}>{isOpen ? '▴' : '▾'}</Text>
      </View>

      {isOpen ? (
        <View style={{ marginTop: 8, borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 8 }}>
          <Text style={{ fontSize: 10, fontWeight: '600', color: theme.textMuted, letterSpacing: 0.5, marginBottom: 4 }}>
            {(rule.heading || '').toUpperCase()}
          </Text>
          <Text style={{ fontSize: 11, lineHeight: 17, color: theme.text }}>{cleanBody}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export function ParkingSignTranslator({ evaluation }: Props) {
  const theme = useThemeColors();
  const rules: TranslatorRule[] = Array.isArray(evaluation?.translator_rules) ? evaluation!.translator_rules! : [];
  const current = rules.find((r) => r.state === 'current') || null;
  const upcoming = rules.find((r) => r.state === 'upcoming') || null;
  const outside = rules.find((r) => r.state === 'outside') || null;

  const others = useMemo(() => {
    const exclude = new Set<string>();
    if (current) exclude.add(ruleKey(current));
    if (upcoming) exclude.add(ruleKey(upcoming));
    if (!current && outside) exclude.add(ruleKey(outside));
    const seen = new Set<string>();
    const out: TranslatorRule[] = [];
    for (const r of rules) {
      const k = ruleKey(r);
      if (exclude.has(k) || seen.has(k)) continue;
      seen.add(k);
      out.push(r);
    }
    return out;
  }, [rules, current, upcoming, outside]);

  const [nowCollapsed, setNowCollapsed] = useState(false);
  const [openExtra, setOpenExtra] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);

  const toggleExtra = (key: string) =>
    setOpenExtra((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const isEmpty = rules.length === 0;
  const showRiskNote = isStrictRule(current) || isStrictRule(upcoming);

  return (
    <View style={{ paddingHorizontal: 20, marginTop: 24, paddingBottom: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12, gap: 12 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: theme.text }}>Parking Sign Translator</Text>
        {!isEmpty ? (
          <Text style={{ fontSize: 10, color: theme.textSecondary }}>Tap a row for full rule</Text>
        ) : null}
      </View>

      {isEmpty ? (
        <View style={{ borderRadius: 12, borderWidth: 1, borderColor: toneBorder('normal', theme), paddingHorizontal: 14, paddingVertical: 12, backgroundColor: theme.chrome }}>
          <Text style={{ fontSize: 12, color: theme.textSecondary }}>
            No rule breakdown available. Check posted signage.
          </Text>
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          {current ? (
            <RuleChip rule={current} tone="now-active" theme={theme} isOpen={!nowCollapsed} onToggle={() => setNowCollapsed((c) => !c)} />
          ) : outside ? (
            <RuleChip rule={outside} tone="now-free" theme={theme} isOpen={!nowCollapsed} onToggle={() => setNowCollapsed((c) => !c)} />
          ) : null}

          {upcoming ? (
            <RuleChip rule={upcoming} tone="next" theme={theme} isOpen={openExtra.has('upcoming')} onToggle={() => toggleExtra('upcoming')} />
          ) : null}

          {showRiskNote ? (
            <View style={{ borderRadius: 10, borderWidth: 1, borderColor: theme.statusCautionBg, backgroundColor: theme.statusCautionBg, paddingHorizontal: 12, paddingVertical: 8 }}>
              <Text style={{ fontSize: 11, lineHeight: 17, color: theme.textSecondary }}>
                <Text style={{ fontWeight: '700' }}>Infringement risk:</Text> amounts vary by rule type and official updates. Check posted signage for enforcement details.
              </Text>
            </View>
          ) : null}

          {others.length > 0 ? (
            <View style={{ marginTop: 4 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: showAll }}
                onPress={() => setShowAll((s) => !s)}
                style={{ minHeight: 44, justifyContent: 'center' }}
              >
                <Text style={{ fontSize: 11, fontWeight: '700', color: theme.tabActive }}>
                  {showAll ? 'Hide full schedule' : `Show full schedule (${others.length})`}
                </Text>
              </Pressable>
              {showAll ? (
                <View style={{ gap: 6, marginTop: 6 }}>
                  {others.map((r, i) => {
                    const k = `o-${i}`;
                    return <RuleChip key={k} rule={r} tone="normal" theme={theme} isOpen={openExtra.has(k)} onToggle={() => toggleExtra(k)} />;
                  })}
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}
