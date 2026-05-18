/** Match web ParkingMap `isAccessibilityBay` — disability signage tags on live bays. */
export function isAccessibilityBay(bay: { bayType?: string | null }): boolean {
  const raw = String(bay?.bayType ?? '').trim().toUpperCase();
  return (
    raw === 'DIS ONLY' ||
    raw === 'DIS' ||
    raw === 'DISABLED' ||
    raw === 'DISABLED PARKING'
  );
}
