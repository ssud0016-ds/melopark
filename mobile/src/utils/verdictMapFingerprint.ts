/** Stable key for planner bulk verdicts — skip map recolor when API returns the same verdicts. */
export function verdictMapFingerprint(v: Record<string, string>): string {
  const keys = Object.keys(v).sort();
  if (keys.length === 0) return '';
  return keys.map((k) => `${k}:${v[k]}`).join('|');
}
