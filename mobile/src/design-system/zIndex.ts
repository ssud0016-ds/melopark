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
  /** Tap-outside layer while search focused — below searchBar */
  searchDismiss: 990,
  /** Maps provider chooser — above bay sheet modal, below toast */
  mapsChooser: 1300,
  searchBar: 1000,
  toast: 1200,
} as const;
