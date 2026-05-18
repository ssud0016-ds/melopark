export type PressureTargetZone = {
  zone_id?: string | number;
  label?: string;
  level?: string;
  pressure?: number;
  free_bays?: number;
  total_bays?: number;
  centroid_lat?: number;
  centroid_lon?: number;
  walk_distance_m?: number;
};

/** Backend AlternativeZone — GET /api/pressure/alternatives */
export type PressureAlternativeZone = {
  zone_id: string | number;
  label: string;
  level?: string;
  pressure?: number;
  free_bays?: number;
  walk_minutes?: number;
  walk_distance_m?: number;
  centroid_lat?: number;
  centroid_lon?: number;
};

export type AlternativesResponse = {
  target_zone?: PressureTargetZone | null;
  alternatives?: PressureAlternativeZone[];
  fallback_mode?: string;
};
