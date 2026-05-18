import { Text, View } from 'react-native';

import { colors } from '../../design-system';
import type { SegmentEventNearby } from '../../utils/segmentDetailFromApi';

function eventLabel(ev: SegmentEventNearby): string {
  const n = ev?.event_name ?? ev?.name;
  return typeof n === 'string' ? n : '';
}

function chipAccessibilityLabel(ev: SegmentEventNearby, label: string): string {
  const parts = [label];
  if (ev.start_iso) parts.push(ev.start_iso);
  return parts.join(' · ');
}

type Props = {
  events?: SegmentEventNearby[];
};

/** Web EventBadge — max 2 chips + "+N". */
export function EventBadge({ events = [] }: Props) {
  if (!events || events.length === 0) return null;
  const head = events.slice(0, 2);
  const more = Math.max(0, events.length - head.length);
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
      {head.map((ev, i) => {
        const label = eventLabel(ev) || 'Event';
        return (
          <View
            key={i}
            accessible
            accessibilityRole="text"
            accessibilityLabel={chipAccessibilityLabel(ev, label)}
            style={{
              borderRadius: 999,
              borderWidth: 1,
              borderColor: '#fde68a',
              backgroundColor: '#fffbeb',
              paddingHorizontal: 6,
              paddingVertical: 2,
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: '600', color: '#92400e' }} numberOfLines={1}>
              {label.slice(0, 22)}
            </Text>
          </View>
        );
      })}
      {more > 0 ? (
        <Text
          style={{ fontSize: 11, fontWeight: '500', color: colors.surfaceDarkTertiary, alignSelf: 'center' }}
          accessibilityLabel={`${more} more events nearby`}
        >
          +{more}
        </Text>
      ) : null}
    </View>
  );
}
