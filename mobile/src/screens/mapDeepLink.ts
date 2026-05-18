import type { Bay } from '../services/apiBays';

export type BayDeepLinkResolution = 'idle' | 'waiting' | 'found' | 'not-found';

export function resolveBayDeepLinkRequest(
  requestedBayId: string | null | undefined,
  bays: Pick<Bay, 'id'>[],
  loading: boolean,
): BayDeepLinkResolution {
  if (!requestedBayId) return 'idle';
  if (loading && bays.length === 0) return 'waiting';
  return bays.some((bay) => bay.id === requestedBayId) ? 'found' : 'not-found';
}
