const mapboxDownloadToken = process.env.MAPBOX_DOWNLOAD_TOKEN;
const mapboxPublicToken = process.env.MAPBOX_PUBLIC_TOKEN;

const plugins = [
  'expo-font',
  [
    'expo-splash-screen',
    {
      backgroundColor: '#35338c',
      android: {
        image: './assets/images/splash-icon.png',
        imageWidth: 120,
      },
    },
  ],
  [
    '@rnmapbox/maps',
    {
      RNMapboxMapsDownloadToken: mapboxDownloadToken,
    },
  ],
  [
    'expo-location',
    {
      locationAlwaysAndWhenInUsePermission:
        'Allow MelOPark to use your location to find parking bays near you.',
    },
  ],
  'expo-navigation-bar',
];

module.exports = {
  expo: {
    name: 'MelOPark',
    slug: 'melopark-mobile',
    version: '1.0.0',
    platforms: ['android'],
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'melopark',
    userInterfaceStyle: 'automatic',
    extra: {
      mapboxPublicToken,
    },
    androidStatusBar: {
      translucent: true,
      backgroundColor: '#00000000',
      barStyle: 'light-content',
    },
    androidNavigationBar: {
      visible: 'sticky-immersive',
      barStyle: 'light-content',
      backgroundColor: '#00000000',
    },
    android: {
      package: 'app.melopark',
      minSdkVersion: 26,
      // Plan §Phase 3 review gate: exactly [FINE, COARSE]. No notifications.
      permissions: ['ACCESS_FINE_LOCATION', 'ACCESS_COARSE_LOCATION'],
      adaptiveIcon: {
        backgroundColor: '#35338c',
        foregroundImage: './assets/images/android-icon-foreground.png',
        monochromeImage: './assets/images/android-icon-monochrome.png',
      },
      predictiveBackGestureEnabled: false,
      // App Links autoVerify — needs /.well-known/assetlinks.json hosted at melopark.app.
      intentFilters: [
        {
          action: 'VIEW',
          autoVerify: true,
          data: [{ scheme: 'https', host: 'melopark.app', pathPrefix: '/' }],
          category: ['BROWSABLE', 'DEFAULT'],
        },
        {
          action: 'VIEW',
          data: [{ scheme: 'melopark' }],
          category: ['BROWSABLE', 'DEFAULT'],
        },
      ],
    },
    plugins,
  },
};
