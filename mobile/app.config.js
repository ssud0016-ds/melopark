const googleMapsApiKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY;
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
  'expo-navigation-bar',
];

if (googleMapsApiKey) {
  plugins.push([
    'react-native-maps',
    {
      androidGoogleMapsApiKey: googleMapsApiKey,
    },
  ]);
}

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
      eas: {
        projectId: '2be96c44-4371-4fe2-8971-5b6198773420',
      },
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
      adaptiveIcon: {
        backgroundColor: '#35338c',
        foregroundImage: './assets/images/icon.png',
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
