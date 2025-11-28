import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.caseflow.mobile',
  appName: 'CaseFlow Mobile',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    iosScheme: 'https'
  },
  ios: {
    scheme: 'CaseFlow Mobile',
    contentInset: 'automatic'
  },
  plugins: {
    Camera: {
      permissions: ['camera', 'photos'],
      iosImagePickerPermissions: ['camera', 'photos'],
      androidImagePickerPermissions: ['camera', 'photos']
    },
    Geolocation: {
      permissions: ['location'],
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 3600000
    },
    LocalNotifications: {
      smallIcon: "ic_stat_icon_config_sample",
      iconColor: "#488AFF",
      sound: "beep.wav"
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"]
    },
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#111827",
      showSpinner: true,
      spinnerColor: "#3b82f6"
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: "#111827",
      overlaysWebView: false
    },
    Filesystem: {
      iosDocumentPath: 'DOCUMENTS',
      androidDocumentPath: 'DOCUMENTS'
    },
    NativeBiometric: {
      useFallback: true,
      fallbackTitle: 'Use Passcode',
      fallbackSubtitle: 'Use your device passcode to authenticate',
      disableBackup: false
    }
  }
};

export default config;
