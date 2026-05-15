export const elevation = {
  card: 1,
  rippleHost: 2,
  mapFloat: 4,
  sheet: 8,
  tabBar: 8,
  overlay: 12,
} as const;

export type ElevationToken = keyof typeof elevation;
