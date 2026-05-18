import type { LinkingOptions } from '@react-navigation/native';
import * as Linking from 'expo-linking';

import type { RootStackParamList } from './types';

const parseStringParam = (value: string) => value;

function createExpoPrefix() {
  try {
    return Linking.createURL('/');
  } catch {
    return 'melopark://';
  }
}

export const linkingConfig: LinkingOptions<RootStackParamList>['config'] = {
  screens: {
    Tabs: {
      screens: {
        MapTab: {
          path: 'map',
          alias: ['bay/:bayId'],
          parse: {
            bayId: parseStringParam,
            segmentId: parseStringParam,
            destinationLat: Number,
            destinationLng: Number,
            destinationLabel: parseStringParam,
            planningMode: (value: string) => (value === 'destination' ? 'destination' : undefined),
          },
        },
        PredictionsTab: 'predictions',
        SearchTab: 'search',
        SettingsTab: 'settings',
      },
    },
    MapsProviderChooser: 'maps-provider',
  },
};

export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [createExpoPrefix(), 'melopark://', 'https://melopark.app'],
  config: linkingConfig,
};
