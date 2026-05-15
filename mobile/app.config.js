const googleMapsApiKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY;

const plugins = [
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
    android: {
      package: 'app.melopark',
      minSdkVersion: 26,
      permissions: [],
      adaptiveIcon: {
        backgroundColor: '#35338c',
        foregroundImage: './assets/images/android-icon-foreground.png',
        monochromeImage: './assets/images/android-icon-monochrome.png',
      },
      predictiveBackGestureEnabled: false,
    },
    plugins,
  },
};
