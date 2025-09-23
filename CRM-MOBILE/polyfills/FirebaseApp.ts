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

const FirebaseApp = {
  initializeApp: (config?: any) => {
    if (isNative && RNFirebaseApp) {
      // Native app - use React Native Firebase
      return RNFirebaseApp.initializeApp(config);
    } else {
      // Web app - Firebase would need to be initialized differently
      console.log('🌐 Web Firebase App initialization (not implemented)');
      return Promise.resolve({
        name: 'web-app',
        options: config || {}
      });
    }
  },

  app: (name?: string) => {
    if (isNative && RNFirebaseApp) {
      return RNFirebaseApp.app(name);
    } else {
      return {
        name: name || 'web-app',
        options: {}
      };
    }
  }
};

export default FirebaseApp;
