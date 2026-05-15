declare module 'react-native-map-clustering' {
  import type { ComponentType, ReactNode } from 'react';
  import type { MapViewProps } from 'react-native-maps';

  type ClusteredMapViewProps = MapViewProps & {
    children?: ReactNode;
    clusterColor?: string;
    radius?: number;
  };

  const ClusteredMapView: ComponentType<ClusteredMapViewProps>;

  export default ClusteredMapView;
}
