/** @type {import('expo/config').ExpoConfig} */
module.exports = {
  name: "Wengz",
  slug: "wengz-mobile",
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
  backgroundColor: "#0E0A14",
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.wengz.client",
    infoPlist: {
      NSCameraUsageDescription: "Upload payment proofs and request attachments.",
      NSPhotoLibraryUsageDescription: "Attach images to requests and payment proofs.",
      NSMicrophoneUsageDescription: "Record voice notes for service requests.",
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
    "expo-localization",
    [
      "expo-av",
      {
        microphonePermission: "Record voice notes for service requests.",
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
    apiUrl: process.env.EXPO_PUBLIC_API_URL || "http://192.168.1.27:3001",
    // Set after `eas init` for push/EAS builds:
    // eas: { projectId: process.env.EAS_PROJECT_ID },
  },
};
