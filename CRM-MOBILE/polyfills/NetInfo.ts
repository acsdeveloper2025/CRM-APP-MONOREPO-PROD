/**
 * NetInfo with platform detection
 * Uses React Native NetInfo for native apps, web APIs for web
 */

import { Capacitor } from '@capacitor/core';
import { Network } from '@capacitor/network';

// Platform detection
const isNative = Capacitor.isNativePlatform();

// Lazy load React Native NetInfo only for native platforms
let RNNetInfo: any = null;
if (isNative) {
  try {
    RNNetInfo = require('@react-native-community/netinfo').default;
    console.log('📱 Native NetInfo loaded for native platform');
  } catch (error) {
    console.warn('React Native NetInfo not available, falling back to Capacitor Network');
  }
}

interface NetInfoState {
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
  type: string;
  details?: any;
}

const NetInfo = {
  async fetch(): Promise<NetInfoState> {
    try {
      if (isNative && RNNetInfo) {
        // Native app - use React Native NetInfo
        const state = await RNNetInfo.fetch();
        return {
          isConnected: state.isConnected,
          isInternetReachable: state.isInternetReachable,
          type: state.type,
          details: state.details
        };
      } else {
        // Web/Capacitor app - use Capacitor Network plugin
        const status = await Network.getStatus();
        return {
          isConnected: status.connected,
          isInternetReachable: status.connected, // Assume if connected, internet is reachable
          type: status.connectionType,
          details: null
        };
      }
    } catch (error) {
      console.warn('NetInfo fetch error:', error);
      // Fallback to navigator.onLine for web
      return {
        isConnected: navigator.onLine,
        isInternetReachable: navigator.onLine,
        type: 'unknown',
        details: null
      };
    }
  },

  addEventListener(listener: (state: NetInfoState) => void) {
    if (isNative && RNNetInfo) {
      // Native app - use React Native NetInfo
      return RNNetInfo.addEventListener(listener);
    } else {
      // Web app - use Capacitor Network listener
      const handleNetworkChange = async () => {
        const state = await this.fetch();
        listener(state);
      };

      Network.addListener('networkStatusChange', handleNetworkChange);
      
      // Return unsubscribe function
      return () => {
        Network.removeAllListeners();
      };
    }
  },

  removeEventListener(listener: any) {
    if (isNative && RNNetInfo) {
      // Native app
      if (typeof listener === 'function') {
        listener(); // Call unsubscribe function
      }
    } else {
      // Web app
      Network.removeAllListeners();
    }
  }
};

export default NetInfo;
