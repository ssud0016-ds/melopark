import type { NavigatorScreenParams } from '@react-navigation/native';

export type TabParamList = {
  MapTab:
    | {
        bayId?: string;
        segmentId?: string;
        destinationLat?: number;
        destinationLng?: number;
        destinationLabel?: string;
        planningMode?: 'destination';
      }
    | undefined;
  PredictionsTab: undefined;
  SearchTab: undefined;
  SettingsTab: undefined;
};

export type RootStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList>;
  MapsProviderChooser: undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
