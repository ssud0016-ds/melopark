import { buildUrl, fetchJson } from './api';

export type BayType = 'available' | 'trap' | 'occupied';

export type Bay = {
  id: string;
  name: string | null;
  type: BayType;
  lat: number;
  lng: number;
  spots: 1;
  free: 0 | 1;
  bayType: string;
  durationMins: number | null;
  hasRules: boolean;
  allowDetail: true;
  sensorLastUpdated: string | null;
  source: 'live';
};

type ApiBayRecord = {
  bay_id?: string;
  bayid?: string;
  status?: string;
  bay_type?: string;
  has_restriction_data?: boolean;
  lat: number;
  lng: number;
  street_name?: string | null;
  duration_mins?: number | null;
  last_updated?: string | null;
};

export function mapApiRecordToBay(record: ApiBayRecord): Bay {
  const id = String(record.bay_id ?? record.bayid ?? '');
  const status = (record.status || 'unknown').toLowerCase();
  const isFree = status === 'free';
  const bayType = record.bay_type || 'Other';
  const hasRules = record.has_restriction_data === true;

  const isDefinitelyRestricted =
    bayType === 'Loading Zone' || bayType === 'No Standing' || bayType === 'Disabled';
  let type: BayType = 'occupied';
  if (isDefinitelyRestricted) type = 'trap';
  else if (isFree) type = 'available';

  return {
    id,
    name: record.street_name || null,
    type,
    lat: record.lat,
    lng: record.lng,
    spots: 1,
    free: isFree ? 1 : 0,
    bayType,
    durationMins: record.duration_mins ?? null,
    hasRules,
    allowDetail: true,
    sensorLastUpdated: record.last_updated ?? null,
    source: 'live',
  };
}

export async function fetchParkingBays(): Promise<Bay[]> {
  const records = await fetchJson<ApiBayRecord[]>(buildUrl('/api/parking'));
  if (!Array.isArray(records)) throw new Error('Unexpected API response shape');
  return records.map(mapApiRecordToBay);
}

export type BayEvaluation = {
  verdict: 'yes' | 'no' | 'unknown';
  reason: string;
  active_restriction: {
    typedesc: string;
    rule_category: string;
    plain_english: string;
    max_stay_mins: number | null;
    expires_at: string | null;
  } | null;
  warning: { description: string } | null;
  data_source: 'db' | 'api_fallback' | 'unknown';
};

export async function fetchBayEvaluation(
  bayId: string,
  options?: { arrivalIso?: string | null; durationMins?: number | null } | null,
): Promise<BayEvaluation | null> {
  if (!bayId) return null;
  try {
    return await fetchJson<BayEvaluation>(
      buildUrl(`/api/bays/${encodeURIComponent(bayId)}/evaluate`, {
        arrival_iso: options?.arrivalIso ?? undefined,
        duration_mins: options?.durationMins ?? undefined,
      }),
    );
  } catch {
    return null;
  }
}

export type BulkVerdict = {
  bay_id: string;
  lat?: number;
  lon?: number;
  verdict: 'yes' | 'no' | 'unknown';
};

export async function fetchEvaluateBulk(
  bbox: string,
  options: { arrivalIso: string; durationMins: number },
): Promise<BulkVerdict[]> {
  if (!bbox) return [];
  try {
    const data = await fetchJson<BulkVerdict[]>(
      buildUrl('/api/bays/evaluate-bulk', {
        bbox,
        arrival_iso: options.arrivalIso,
        duration_mins: options.durationMins,
      }),
    );
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export type BayCarbon = { saved_g: number; pct_avoided: number; score: number };

export async function fetchBayCarbon(bayId: string): Promise<BayCarbon | null> {
  if (!bayId) return null;
  try {
    return await fetchJson<BayCarbon>(buildUrl(`/api/bays/${encodeURIComponent(bayId)}/carbon`));
  } catch {
    return null;
  }
}

export async function fetchAccessibilityNearby(params: {
  lat: number;
  lon: number;
  radiusM?: number;
  topN?: number;
  availableOnly?: boolean;
}): Promise<unknown | null> {
  const { lat, lon, radiusM = 500, topN = 20, availableOnly = false } = params;
  if (lat == null || lon == null) return null;
  return fetchJson(
    buildUrl('/api/accessibility/nearby', {
      lat,
      lon,
      radius_m: radiusM,
      top_n: topN,
      available_only: availableOnly,
    }),
  );
}
