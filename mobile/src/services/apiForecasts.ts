import { buildUrl, fetchJson } from './api';

export type WarningLevel = 'low' | 'moderate' | 'high' | 'critical';

export type ForecastWarning = {
  zone: string;
  hours_from_now: number;
  warning_level: WarningLevel;
  predicted_occupancy?: number;
  event_risk_level?: WarningLevel | string;
  events_nearby?: string;
  zone_lat?: number;
  zone_lon?: number;
  warning_message?: string;
  description?: string;
};

export type ForecastWarningsResponse = {
  generated_at: string;
  hours_ahead: number;
  data_source: string;
  warnings: ForecastWarning[];
};

export async function fetchForecastWarnings(hours = 6): Promise<ForecastWarningsResponse> {
  return fetchJson(buildUrl('/api/forecasts/warnings', { hours }));
}

export type ForecastPressureResponse = {
  generated_at: string;
  arrival_at: string | null;
  data_source: string;
  zones: { zone: string; pressure_level: WarningLevel }[];
};

export async function fetchForecastPressure(at: string | null = null): Promise<ForecastPressureResponse> {
  return fetchJson(buildUrl('/api/forecasts/pressure', { at: at ?? undefined }));
}

export type ForecastTargetZone = {
  zone: string;
  predicted_occ?: number;
  pressure_level?: WarningLevel;
  zone_lat?: number;
  zone_lon?: number;
};

export type ForecastAlternative = {
  zone: string;
  predicted_occ?: number;
  alt_predicted_occupancy?: number;
  predicted_occupancy?: number;
  pressure_level?: WarningLevel;
  warning_level?: WarningLevel;
  zone_lat?: number;
  zone_lon?: number;
  distance_m?: number;
  walk_distance_m?: number;
  walk_minutes?: number;
  score?: number;
};

export type ForecastAlternativesResponse = {
  target_zone: ForecastTargetZone | string | null;
  alternatives: ForecastAlternative[];
  at?: string | null;
  generated_at?: string;
};

export async function fetchForecastAlternatives(
  lat: number,
  lon: number,
  at: string | null = null,
  radius = 800,
  limit = 5,
): Promise<ForecastAlternativesResponse> {
  return fetchJson(
    buildUrl('/api/forecasts/alternatives', { lat, lon, radius, limit, at: at ?? undefined }),
  );
}

export async function fetchForecastEventRisk(): Promise<{ generated_at: string; event_risks: unknown[] }> {
  return fetchJson(buildUrl('/api/forecasts/events'));
}
