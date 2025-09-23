/**
 * Firebase Messaging with platform detection
 * Uses React Native Firebase Messaging for native apps, web push for web
 */

import { Capacitor } from '@capacitor/core';

// Platform detection
const isNative = Capacitor.isNativePlatform();

// Lazy load React Native Firebase Messaging only for native platforms
let RNFirebaseMessaging: any = null;
if (isNative) {
  try {
    RNFirebaseMessaging = require('@react-native-firebase/messaging').default;
    console.log('📱 Native Firebase Messaging loaded for native platform');
  } catch (error) {
    console.warn('React Native Firebase Messaging not available:', error);
  }
}

// Web messaging implementation using Service Worker
class WebMessaging {
  async requestPermission(): Promise<string> {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      return permission === 'granted' ? 'authorized' : 'denied';
    }
    return 'denied';
  }

  async getToken(): Promise<string> {
    // In a real implementation, you'd register a service worker
    // and get a push subscription token
    console.log('🌐 Web push token generation (simplified)');
    return 'web-push-token-' + Date.now();
  }

  onMessage(handler: (message: any) => void) {
    // Web implementation would listen for push events
    console.log('🌐 Web message listener registered');
    return () => console.log('🌐 Web message listener unregistered');
  }

  setBackgroundMessageHandler(handler: (message: any) => void) {
    // Web implementation would handle service worker messages
    console.log('🌐 Web background message handler registered');
  }

  onNotificationOpenedApp(handler: (message: any) => void) {
    // Web implementation would handle notification clicks
    console.log('🌐 Web notification opened handler registered');
  }

  getInitialNotification(): Promise<any> {
    // Web implementation would check if app was opened from notification
    return Promise.resolve(null);
  }
}

const messaging = () => {
  if (isNative && RNFirebaseMessaging) {
    return RNFirebaseMessaging();
  } else {
    return new WebMessaging();
  }
};

// Add static properties for authorization status
messaging.AuthorizationStatus = {
  NOT_DETERMINED: -1,
  DENIED: 0,
  AUTHORIZED: 1,
  PROVISIONAL: 2
};

export default messaging;
export { messaging };
