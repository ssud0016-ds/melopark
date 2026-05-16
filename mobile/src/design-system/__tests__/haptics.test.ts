import * as Haptics from 'expo-haptics';

import { haptics } from '../haptics';

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(),
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
}));

describe('haptics', () => {
  beforeEach(() => jest.clearAllMocks());

  // §7.7
  test('light() calls Haptics.impactAsync with Light', async () => {
    (Haptics.impactAsync as jest.Mock).mockResolvedValueOnce(undefined);
    await haptics.light();
    expect(Haptics.impactAsync).toHaveBeenCalledWith('light');
  });

  test('medium() calls Haptics.impactAsync with Medium', async () => {
    (Haptics.impactAsync as jest.Mock).mockResolvedValueOnce(undefined);
    await haptics.medium();
    expect(Haptics.impactAsync).toHaveBeenCalledWith('medium');
  });

  // §7.8
  test('is no-op when haptics throw (denied / unsupported)', async () => {
    (Haptics.impactAsync as jest.Mock).mockRejectedValueOnce(new Error('denied'));
    await expect(haptics.light()).resolves.toBeUndefined();
  });
});
