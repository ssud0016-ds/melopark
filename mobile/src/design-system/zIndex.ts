export const zIndex = {
  tabBar: 490,
  pill: 495,
  scopeStrip: 500,
  /** ScopeStrip + MapLegend — above parking chance sheet while dragging */
  mapChrome: 560,
  /** Cluster zoom hint — below search, above ScopeStrip */
  mapHint: 555,
  sheet: 550,
  settingsSheet: 570,
  onboarding: 800,
  searchBar: 1000,
  toast: 1200,
} as const;
