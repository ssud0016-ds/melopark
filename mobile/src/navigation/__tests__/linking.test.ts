import { getStateFromPath } from '@react-navigation/native';

import { linking, linkingConfig } from '../linking';

describe('mobile deep linking', () => {
  test('routes bay paths to the Map tab with a bayId param', () => {
    const state = getStateFromPath('/bay/12345', linkingConfig);

    expect(state?.routes[0]).toMatchObject({
      name: 'Tabs',
      state: {
        routes: [{ name: 'MapTab', params: { bayId: '12345' } }],
      },
    });
  });

  test('declares custom scheme and app link prefixes', () => {
    expect(linking.prefixes).toEqual(
      expect.arrayContaining(['melopark://', 'https://melopark.app']),
    );
  });
});
