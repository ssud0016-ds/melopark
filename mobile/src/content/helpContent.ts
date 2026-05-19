import { getStatusFillColor, PRESSURE_UNKNOWN_COLOR } from '../utils/pressureSegmentStyle';

export type HelpTabId = 'map' | 'pressure' | 'filters' | 'bay';

export const HELP_TABS: { id: HelpTabId; label: string }[] = [
  { id: 'map', label: 'Map' },
  { id: 'pressure', label: 'Parking Pressure' },
  { id: 'filters', label: 'Filters' },
  { id: 'bay', label: 'Bay Details' },
];

/** Swatch colours aligned with map rendering (pressureSegmentStyle). */
export const HELP_LEGEND_COLORS = {
  bayAvailable: getStatusFillColor('available'),
  bayOccupied: getStatusFillColor('occupied'),
  streetGood: getStatusFillColor('available'),
  streetBusy: getStatusFillColor('caution'),
  streetHard: getStatusFillColor('occupied'),
  streetUnknown: PRESSURE_UNKNOWN_COLOR,
  accessible: '#60a5fa',
  chipBrand: '#35338c',
  chipAvailable: '#15803d',
  chipAccessible: '#3b82f6',
} as const;

export type HelpVisual =
  | { type: 'dot'; color: string }
  | { type: 'line'; color: string }
  | { type: 'chip'; text: string; color: string }
  | { type: 'emoji'; emoji: string }
  | { type: 'badge'; variant: 'yes' | 'no' | 'caution' };

export type HelpLegendItem = {
  kind: 'legend';
  label: string;
  sub?: string;
  visual: HelpVisual;
};

export type HelpParagraph = {
  kind: 'paragraph';
  text: string;
};

export type HelpSection = {
  title: string;
  blocks: (HelpLegendItem | HelpParagraph)[];
};

export const HELP_TAB_SECTIONS: Record<HelpTabId, HelpSection[]> = {
  map: [
    {
      title: 'Bay colours',
      blocks: [
        {
          kind: 'legend',
          visual: { type: 'dot', color: HELP_LEGEND_COLORS.bayAvailable },
          label: 'Green: available',
          sub: 'Bay is free right now',
        },
        {
          kind: 'legend',
          visual: { type: 'dot', color: HELP_LEGEND_COLORS.bayOccupied },
          label: 'Red: occupied',
          sub: 'Bay is taken',
        },
        {
          kind: 'legend',
          visual: { type: 'dot', color: HELP_LEGEND_COLORS.accessible },
          label: 'Blue: accessible bay',
          sub: 'Disabled permit holders',
        },
      ],
    },
    {
      title: 'Interacting',
      blocks: [
        {
          kind: 'paragraph',
          text: "Tap any bay dot to see its parking rules, time limits, and a verdict on whether it's safe to park.",
        },
      ],
    },
  ],
  pressure: [
    {
      title: 'Street colours',
      blocks: [
        {
          kind: 'legend',
          visual: { type: 'line', color: HELP_LEGEND_COLORS.streetGood },
          label: 'Green',
          sub: 'Good chance of finding a spot',
        },
        {
          kind: 'legend',
          visual: { type: 'line', color: HELP_LEGEND_COLORS.streetBusy },
          label: 'Orange',
          sub: 'Getting busy',
        },
        {
          kind: 'legend',
          visual: { type: 'line', color: HELP_LEGEND_COLORS.streetHard },
          label: 'Red',
          sub: 'Hard to park right now',
        },
        {
          kind: 'legend',
          visual: { type: 'line', color: HELP_LEGEND_COLORS.streetUnknown },
          label: 'Grey',
          sub: 'No live estimate for this street',
        },
      ],
    },
    {
      title: 'Tap a coloured street',
      blocks: [
        {
          kind: 'paragraph',
          text: 'Tap any coloured street to see free bays, pressure %, and nearby events affecting demand.',
        },
      ],
    },
    {
      title: 'Alternative Zones',
      blocks: [
        {
          kind: 'paragraph',
          text: 'The panel shows quieter areas near your destination. Tap a zone card to fly the map there and see available bays.',
        },
      ],
    },
    {
      title: 'Quiet Streets',
      blocks: [
        {
          kind: 'paragraph',
          text: 'Top 3 least-busy streets in the current map view. Tap to zoom in on any of them.',
        },
      ],
    },
    {
      title: 'Data sources',
      blocks: [
        {
          kind: 'legend',
          visual: { type: 'emoji', emoji: '📡' },
          label: 'Live sensors',
          sub: 'City of Melbourne bay sensors, ~8 s refresh',
        },
        {
          kind: 'legend',
          visual: { type: 'emoji', emoji: '🚦' },
          label: 'SCATS',
          sub: 'Traffic signal historical profile',
        },
        {
          kind: 'legend',
          visual: { type: 'emoji', emoji: '🎭' },
          label: 'Events',
          sub: 'Active Melbourne events affecting demand',
        },
      ],
    },
  ],
  filters: [
    {
      title: 'Status filter',
      blocks: [
        {
          kind: 'legend',
          visual: { type: 'chip', text: 'All', color: HELP_LEGEND_COLORS.chipBrand },
          label: 'Show every bay',
        },
        {
          kind: 'legend',
          visual: { type: 'chip', text: 'Available', color: HELP_LEGEND_COLORS.chipAvailable },
          label: 'Only free bays right now',
        },
        {
          kind: 'legend',
          visual: { type: 'chip', text: 'Accessible', color: HELP_LEGEND_COLORS.chipAccessible },
          label: 'Disabled-permit bays only',
        },
      ],
    },
    {
      title: 'Duration filter',
      blocks: [
        {
          kind: 'paragraph',
          text: "Shows only bays that are legally parkable for your chosen stay length. A 2H bay won't appear when you filter for 3H.",
        },
      ],
    },
    {
      title: 'Arrival time planner',
      blocks: [
        {
          kind: 'paragraph',
          text: 'Set a date and time to evaluate parking rules at that moment — not live. Useful for planning ahead. A Planned badge appears when active. Tap Clear to return to live mode.',
        },
      ],
    },
    {
      title: 'Map at planned time',
      blocks: [
        {
          kind: 'paragraph',
          text: 'When you set an arrival time, map bay colors reflect parking rules at that planned time (not live occupancy).',
        },
      ],
    },
  ],
  bay: [
    {
      title: 'Verdict card',
      blocks: [
        {
          kind: 'legend',
          visual: { type: 'badge', variant: 'yes' },
          label: '',
          sub: 'Safe to park for your selected time',
        },
        {
          kind: 'legend',
          visual: { type: 'badge', variant: 'no' },
          label: '',
          sub: 'Not allowed right now',
        },
        {
          kind: 'legend',
          visual: { type: 'badge', variant: 'caution' },
          label: '',
          sub: 'Tow-away or loading zone risk',
        },
      ],
    },
    {
      title: 'Future-time notice',
      blocks: [
        {
          kind: 'paragraph',
          text: 'Amber notice: live occupancy is unknown for future times; rules are evaluated for your scheduled arrival.',
        },
      ],
    },
    {
      title: 'Sign Translator',
      blocks: [
        {
          kind: 'paragraph',
          text: 'A plain-English breakdown of the parking sign rules for each bay — no decoding needed.',
        },
      ],
    },
    {
      title: 'Leave By time',
      blocks: [
        {
          kind: 'paragraph',
          text: 'Shown when planning ahead. The latest time you must move your car to avoid a fine.',
        },
      ],
    },
  ],
};
