import * as Linking from 'expo-linking';
import type { LinkingOptions } from '@react-navigation/native';

import type { RootStackParamList } from './types';

// Plan §3 + §12.8: melopark://bay/:id (scheme) + https://melopark.app/bay/:id (App Links).
// Bay deep link → MapTab with bayId param; MapScreen auto-opens BayDetailSheet on mount.
export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [Linking.createURL('/'), 'melopark://', 'https://melopark.app'],
  config: {
    screens: {
      Tabs: {
        screens: {
          MapTab: {
            path: 'map',
            parse: { bayId: (v: string) => v, segmentId: (v: string) => v },
          },
          PredictionsTab: 'predictions',
          SearchTab: 'search',
          SettingsTab: 'settings',
        },
      },
      MapsProviderChooser: 'maps-provider',
      MapSpike: 'dev/map-spike',
    },
  },
};
