/**
 * Push Notification with platform detection
 * Uses React Native Push Notification for native apps, web notifications for web
 */

import { Capacitor } from '@capacitor/core';

// Platform detection
const isNative = Capacitor.isNativePlatform();

// Lazy load React Native Push Notification only for native platforms
let RNPushNotification: any = null;
if (isNative) {
  try {
    RNPushNotification = require('react-native-push-notification').default;
    console.log('📱 Native Push Notification loaded for native platform');
  } catch (error) {
    console.warn('React Native Push Notification not available:', error);
  }
}

// Web notification implementation
class WebPushNotification {
  configure(config: any) {
    console.log('🌐 Web push notification configured:', config);
    
    // Simulate registration
    if (config.onRegister) {
      setTimeout(() => {
        config.onRegister({
          os: 'web',
          token: 'web-push-token-' + Date.now()
        });
      }, 100);
    }

    // Store config for later use
    this.config = config;
  }

  localNotification(details: any) {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(details.title || 'Notification', {
        body: details.message || details.body || '',
        icon: details.largeIcon || details.smallIcon,
        tag: details.tag,
        data: details.userInfo || details.data
      });
    } else {
      console.warn('🌐 Web notifications not available or permission denied');
    }
  }

  scheduleLocalNotification(details: any) {
    // Web implementation would use setTimeout or service worker
    const delay = details.date ? new Date(details.date).getTime() - Date.now() : 0;
    
    if (delay > 0) {
      setTimeout(() => {
        this.localNotification(details);
      }, delay);
    } else {
      this.localNotification(details);
    }
  }

  cancelLocalNotifications(details: any) {
    console.log('🌐 Web notification cancellation (simplified):', details);
  }

  cancelAllLocalNotifications() {
    console.log('🌐 Web cancel all notifications (simplified)');
  }

  setApplicationIconBadgeNumber(number: number) {
    console.log('🌐 Web badge number (not supported):', number);
  }

  getApplicationIconBadgeNumber(callback: (number: number) => void) {
    callback(0); // Web doesn't support badge numbers
  }

  private config: any = null;
}

const PushNotification = {
  configure: (config: any) => {
    if (isNative && RNPushNotification) {
      RNPushNotification.configure(config);
    } else {
      const webPN = new WebPushNotification();
      webPN.configure(config);
      // Store web instance for other methods
      Object.assign(PushNotification, webPN);
    }
  },

  localNotification: (details: any) => {
    if (isNative && RNPushNotification) {
      RNPushNotification.localNotification(details);
    } else {
      const webPN = new WebPushNotification();
      webPN.localNotification(details);
    }
  },

  scheduleLocalNotification: (details: any) => {
    if (isNative && RNPushNotification) {
      RNPushNotification.scheduleLocalNotification(details);
    } else {
      const webPN = new WebPushNotification();
      webPN.scheduleLocalNotification(details);
    }
  },

  cancelLocalNotifications: (details: any) => {
    if (isNative && RNPushNotification) {
      RNPushNotification.cancelLocalNotifications(details);
    } else {
      const webPN = new WebPushNotification();
      webPN.cancelLocalNotifications(details);
    }
  },

  cancelAllLocalNotifications: () => {
    if (isNative && RNPushNotification) {
      RNPushNotification.cancelAllLocalNotifications();
    } else {
      const webPN = new WebPushNotification();
      webPN.cancelAllLocalNotifications();
    }
  },

  setApplicationIconBadgeNumber: (number: number) => {
    if (isNative && RNPushNotification) {
      RNPushNotification.setApplicationIconBadgeNumber(number);
    } else {
      const webPN = new WebPushNotification();
      webPN.setApplicationIconBadgeNumber(number);
    }
  },

  getApplicationIconBadgeNumber: (callback: (number: number) => void) => {
    if (isNative && RNPushNotification) {
      RNPushNotification.getApplicationIconBadgeNumber(callback);
    } else {
      const webPN = new WebPushNotification();
      webPN.getApplicationIconBadgeNumber(callback);
    }
  }
};

export default PushNotification;
