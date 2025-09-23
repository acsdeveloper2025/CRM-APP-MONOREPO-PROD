/**
 * Firebase App with platform detection
 * Uses React Native Firebase for native apps, web Firebase for web
 */

import { Capacitor } from '@capacitor/core';

// Platform detection
const isNative = Capacitor.isNativePlatform();

// Lazy load React Native Firebase only for native platforms
let RNFirebaseApp: any = null;
if (isNative) {
  try {
    RNFirebaseApp = require('@react-native-firebase/app').default;
    console.log('📱 Native Firebase App loaded for native platform');
  } catch (error) {
    console.warn('React Native Firebase App not available:', error);
  }
}

// Web Firebase configuration from environment variables
const webFirebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

const FirebaseApp = {
  initializeApp: (config?: any) => {
    if (isNative && RNFirebaseApp) {
      // Native app - use React Native Firebase (config from google-services.json)
      return RNFirebaseApp.initializeApp(config);
    } else {
      // Web app - use web Firebase config
      console.log('🌐 Web Firebase App initialization with config:', webFirebaseConfig);
      return Promise.resolve({
        name: 'web-app',
        options: config || webFirebaseConfig
      });
    }
  },

  app: (name?: string) => {
    if (isNative && RNFirebaseApp) {
      return RNFirebaseApp.app(name);
    } else {
      return {
        name: name || 'web-app',
        options: webFirebaseConfig
      };
    }
  }
};

export default FirebaseApp;
