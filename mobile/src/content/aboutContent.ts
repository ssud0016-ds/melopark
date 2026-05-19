/** About page copy — mirrors frontend/src/components/home/AboutPage.jsx */

export const ABOUT_BADGE = 'Smarter parking - Cleaner city - Reducing emissions';

export const ABOUT_HERO_SUBCOPY =
  'Real-time parking intelligence for Melbourne CBD. Find available bays, check parking rules, and avoid fines even before you even leave home.';

export const PAIN_POINTS = [
  { value: '30 Minutes +', desc: 'spent circling for a spot' },
  { value: '$350 +', desc: 'average parking fines' },
  { value: '30 %', desc: 'of CBD traffic is just cruising' },
] as const;

export const FRICTION_CARDS = [
  {
    title: 'Confusing Signs',
    desc: '"2P Meter 8-4 Mon-Fri" - What does that mean?',
  },
  {
    title: 'Hidden Rule Traps',
    desc: '"Park legally at 4PM, tow away zone at 4:15"',
  },
] as const;

export type FixCardIcon = 'sun' | 'rule' | 'alert' | 'search';

export const FIX_CARDS: ReadonlyArray<{ title: string; desc: string; icon: FixCardIcon }> = [
  { title: 'Live availability', desc: 'Real-time sensor data', icon: 'sun' },
  { title: 'Clear rules', desc: 'Complex signs decoded to English', icon: 'rule' },
  { title: 'Trap alerts', desc: 'Clear warnings before you are fined', icon: 'alert' },
  { title: 'Search & go', desc: 'Find bays near any address', icon: 'search' },
];
