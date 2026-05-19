import type { NavigatorScreenParams } from '@react-navigation/native';

export type TabParamList = {
  MapTab: { bayId?: string; segmentId?: string } | undefined;
  PredictionsTab: undefined;
};

export type MapsProviderChooserParams = {
  pendingMode?: 'drive' | 'walk';
  bayLat: number;
  bayLng: number;
  bayLabel?: string;
  destLat?: number;
  destLng?: number;
};

export type RootStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList>;
  About: undefined;
  Attribution: undefined;
  Terms: undefined;
  MapsProviderChooser: MapsProviderChooserParams | undefined;
  MapSpike: undefined; // dev-only
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
