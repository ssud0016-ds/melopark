import type { NavigatorScreenParams } from '@react-navigation/native';

export type TabParamList = {
  MapTab: { bayId?: string; segmentId?: string } | undefined;
  PredictionsTab: undefined;
};

export type RootStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList>;
  About: undefined;
  Attribution: undefined;
  Terms: undefined;
  MapsProviderChooser: undefined;
  MapSpike: undefined; // dev-only
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
