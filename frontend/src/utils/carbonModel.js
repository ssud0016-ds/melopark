// MeloPark Epic 8 — CO2 model
// NTC 2024: 193.7g/km, baseline 2.0km (6.03min at 20km/h)
export const EF = 193.7;
export const BASELINE_KM = 2.0;
export const BASELINE_G  = BASELINE_KM * EF;

export function calcCarbon({ occupancyPct, walkMetres }) {
  if (occupancyPct == null) return null;
  const hour   = new Date().getHours();
  const peak   = (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19);
  const factor = peak ? 1.35 : 1.0;
  const searchKm = Math.min(BASELINE_KM, (0.05 + (occupancyPct / 100) * 1.95) * factor);
  const savedG   = Math.max(0, (BASELINE_KM - searchKm) * EF);
  const pct      = Math.round((savedG / BASELINE_G) * 100);
  const score    = Math.min(100, Math.round((savedG/BASELINE_G * 0.75 + (occupancyPct/100) * 0.25) * 100));
  return { savedG: Math.round(savedG), pct, score };
}
