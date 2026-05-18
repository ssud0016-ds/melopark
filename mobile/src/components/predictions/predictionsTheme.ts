/** Web PredictionsPage.jsx palette — keep in sync with frontend. */
export const PREDICTIONS_BRAND = '#2E2A8A';
export const PREDICTIONS_TEAL = '#1D9E75';

export const PREDICTIONS_GRADIENT = {
  colors: ['#080620', PREDICTIONS_BRAND, '#0d3020'] as const,
  locations: [0, 0.62, 1] as const,
  start: { x: 0, y: 0 },
  end: { x: 1, y: 1 },
};

export function predictionsPageBg(dark: boolean): string {
  return dark ? '#030712' : '#E8EBF8';
}

export function predictionsCardBg(dark: boolean): string {
  return dark ? '#0f172a' : '#F2F4FD';
}

export function predictionsCardBorder(dark: boolean): string {
  return dark ? 'rgba(255,255,255,0.08)' : '#c8ccec';
}

export function predictionsSectionLabel(dark: boolean): string {
  return dark ? '#64748b' : '#94a3b8';
}

export function predictionsHeaderMuted(): string {
  return 'rgba(255,255,255,0.55)';
}

export function predictionsKpiLabel(): string {
  return 'rgba(255,255,255,0.4)';
}

export function predictionsKpiSub(): string {
  return 'rgba(255,255,255,0.35)';
}

export const PREDICTIONS_KPI_GLASS = {
  backgroundColor: 'rgba(255,255,255,0.09)',
  borderColor: 'rgba(255,255,255,0.13)',
};

export const PREDICTIONS_SEARCH_GLASS = {
  backgroundColor: 'rgba(255,255,255,0.13)',
  borderColor: 'rgba(255,255,255,0.2)',
};

export function arcSectionBg(dark: boolean, levelColor: string): string {
  return dark ? `${levelColor}33` : levelColor;
}
