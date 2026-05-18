import * as Linking from 'expo-linking';
import type { LinkingOptions } from '@react-navigation/native';

import type { RootStackParamList } from './types';

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
        },
      },
      About: 'about',
      Attribution: 'attribution',
      Terms: 'terms',
      MapsProviderChooser: 'maps-provider',
      MapSpike: 'dev/map-spike',
    },
  },
};
