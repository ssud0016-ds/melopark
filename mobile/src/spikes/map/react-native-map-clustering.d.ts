declare module 'react-native-map-clustering' {
  import type { ComponentType, ReactNode } from 'react';

  type ClusteredMapViewProps = {
    children?: ReactNode;
    clusterColor?: string;
    radius?: number;
    [key: string]: unknown;
  };

  const ClusteredMapView: ComponentType<ClusteredMapViewProps>;

  export default ClusteredMapView;
}
