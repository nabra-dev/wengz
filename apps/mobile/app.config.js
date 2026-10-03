/** @type {import('expo/config').ExpoConfig} */
module.exports = {
  name: "Wengz",
  slug: "wengz-mobile",
  owner: "wengz",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  scheme: "wengz",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  splash: {
    image: "./assets/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: "#0E0A14",
  },
  web: {
    favicon: "./assets/favicon.png",
  },
  backgroundColor: "#0E0A14",
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.wengz.client",
    infoPlist: {
      NSCameraUsageDescription: "Upload payment proofs and request attachments.",
      NSPhotoLibraryUsageDescription: "Attach images to requests and payment proofs.",
      NSMicrophoneUsageDescription: "Record voice notes for service requests.",
      ITSAppUsesNonExemptEncryption: false,
      // Required by react-native-screens when using native statusBarStyle options.
      UIViewControllerBasedStatusBarAppearance: true,
      // Dev: allow HTTP to LAN Next.js API from Expo Go / device.
      NSAppTransportSecurity: {
        NSAllowsLocalNetworking: true,
        NSAllowsArbitraryLoads: true,
      },
    },
  },
  android: {
    package: "com.wengz.client",
    usesCleartextTraffic: true,
    adaptiveIcon: {
      backgroundColor: "#0E0A14",
      foregroundImage: "./assets/android-icon-foreground.png",
      backgroundImage: "./assets/android-icon-background.png",
      monochromeImage: "./assets/android-icon-monochrome.png",
    },
    permissions: [
      "android.permission.CAMERA",
      "android.permission.READ_MEDIA_IMAGES",
      "android.permission.RECORD_AUDIO",
      "android.permission.POST_NOTIFICATIONS",
    ],
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    [
      "expo-splash-screen",
      {
        image: "./assets/splash-icon.png",
        backgroundColor: "#0E0A14",
        resizeMode: "contain",
      },
    ],
    [
      "expo-localization",
      {
        supportsRTL: true,
        supportedLocales: {
          ios: ["en", "ar"],
          android: ["en", "ar"],
        },
      },
    ],
    [
      "expo-audio",
      {
        microphonePermission: "Record voice notes for service requests.",
        recordAudioAndroid: true,
      },
    ],
    // Push is limited in Expo Go (SDK 53+); full push needs a dev/EAS build.
    [
      "expo-notifications",
      {
        color: "#690DD4",
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    router: {},
    supportsRTL: true,
    apiUrl: process.env.EXPO_PUBLIC_API_URL || "http://192.168.1.27:3001",
    eas: {
      projectId: "c0a30a47-f88b-456f-bea0-dcc3340c97ce",
    },
  },
};
