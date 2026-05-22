import type { Landmark } from '../data/landmarks';

/** Web FlyToController: fly back to default CBD view when destination is cleared. */
export function shouldFlyBackToDefaultOnDestinationClear(
  prev: Landmark | null,
  next: Landmark | null,
): boolean {
  return prev != null && next == null;
}
