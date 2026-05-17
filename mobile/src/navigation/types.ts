import type { NavigatorScreenParams } from '@react-navigation/native';

export type TabParamList = {
  MapTab: { bayId?: string; segmentId?: string } | undefined;
  PredictionsTab: undefined;
  SearchTab: undefined;
  SettingsTab: undefined;
};

export type RootStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList>;
  MapsProviderChooser: undefined;
  MapSpike: undefined; // dev-only
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
