/** Map GET /api/pressure/segments/{id} JSON → SegmentPopup `detail` prop shape. */
export function segmentDetailFromApi(api) {
  if (!api) return null
  return {
    street_name: api.street_name,
    seg_descr: api.seg_descr,
    level: api.level,
    trend: api.trend,
    pressure: api.pressure,
    total_bays: api.total,
    free_bays: api.free,
    sampled_bays: api.sampled_bays,
    has_live_bays: api.has_live_bays,
    occ_pct: api.occ_pct,
    events_nearby: (api.events || []).map((e) => ({
      event_name: e.name,
      distance_m: e.distance_m,
      start_iso: e.start_iso,
    })),
  }
}
