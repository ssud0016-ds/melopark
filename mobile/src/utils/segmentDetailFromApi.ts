export type SegmentEventNearby = {
  event_name?: string;
  /** API raw field when passed through without mapping. */
  name?: string;
  distance_m?: number;
  start_iso?: string;
};

export type SegmentPopupDetail = {
  street_name?: string;
  seg_descr?: string;
  level?: string;
  trend?: string;
  pressure?: number;
  total_bays?: number;
  free_bays?: number;
  sampled_bays?: number;
  has_live_bays?: boolean;
  occ_pct?: number | null;
  events_nearby?: SegmentEventNearby[];
  events?: SegmentEventNearby[];
};

type SegmentApiResponse = {
  street_name?: string;
  seg_descr?: string;
  level?: string;
  trend?: string;
  pressure?: number;
  total?: number;
  free?: number;
  sampled_bays?: number;
  has_live_bays?: boolean;
  occ_pct?: number | null;
  events?: Array<{ name?: string; distance_m?: number; start_iso?: string }>;
};

/** Map GET /api/pressure/segments/{id} JSON → SegmentPopup `detail` prop shape. */
export function segmentDetailFromApi(api: unknown): SegmentPopupDetail | null {
  if (!api || typeof api !== 'object') return null;
  const row = api as SegmentApiResponse;
  const eventsMapped = (row.events || []).map((e) => ({
    event_name: e.name,
    distance_m: e.distance_m,
    start_iso: e.start_iso,
  }));
  return {
    street_name: row.street_name,
    seg_descr: row.seg_descr,
    level: row.level,
    trend: row.trend,
    pressure: row.pressure,
    total_bays: row.total,
    free_bays: row.free,
    sampled_bays: row.sampled_bays,
    has_live_bays: row.has_live_bays,
    occ_pct: row.occ_pct,
    events_nearby: eventsMapped,
    events: eventsMapped,
  };
}
