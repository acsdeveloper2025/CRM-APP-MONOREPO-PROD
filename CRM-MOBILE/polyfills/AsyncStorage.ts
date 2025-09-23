/**
 * AsyncStorage with platform detection
 * Uses React Native AsyncStorage for native apps, localStorage for web
 */

import { Capacitor } from '@capacitor/core';

// Platform detection
const isNative = Capacitor.isNativePlatform();

// Lazy load React Native AsyncStorage only for native platforms
let RNAsyncStorage: any = null;
if (isNative) {
  try {
    RNAsyncStorage = require('@react-native-async-storage/async-storage').default;
    console.log('📱 Native AsyncStorage loaded for native platform');
  } catch (error) {
    console.warn('React Native AsyncStorage not available, falling back to localStorage');
  }
}

const AsyncStorage = {
  async getItem(key: string): Promise<string | null> {
    try {
      if (isNative && RNAsyncStorage) {
        // Native app - use React Native AsyncStorage
        return await RNAsyncStorage.getItem(key);
      } else {
        // Web app - use localStorage
        return localStorage.getItem(key);
      }
    } catch (error) {
      console.warn('AsyncStorage getItem error:', error);
      return null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    try {
      if (isNative && RNAsyncStorage) {
        // Native app - use React Native AsyncStorage (much larger limits)
        await RNAsyncStorage.setItem(key, value);
        console.log(`📱 Native storage: Saved ${value.length} characters for key: ${key}`);
      } else {
        // Web app - use localStorage (limited to ~5-10MB)
        localStorage.setItem(key, value);
        console.log(`🌐 Web storage: Saved ${value.length} characters for key: ${key}`);
      }
    } catch (error) {
      console.error('AsyncStorage setItem error:', error);
      throw error; // Re-throw to trigger quota exceeded handling
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      if (isNative && RNAsyncStorage) {
        await RNAsyncStorage.removeItem(key);
      } else {
        localStorage.removeItem(key);
      }
    } catch (error) {
      console.warn('AsyncStorage removeItem error:', error);
    }
  },

  async clear(): Promise<void> {
    try {
      if (isNative && RNAsyncStorage) {
        await RNAsyncStorage.clear();
      } else {
        localStorage.clear();
      }
    } catch (error) {
      console.warn('AsyncStorage clear error:', error);
    }
  },

  async getAllKeys(): Promise<string[]> {
    try {
      if (isNative && RNAsyncStorage) {
        return await RNAsyncStorage.getAllKeys();
      } else {
        return Object.keys(localStorage);
      }
    } catch (error) {
      console.warn('AsyncStorage getAllKeys error:', error);
      return [];
    }
  },

  async multiRemove(keys: string[]): Promise<void> {
    try {
      if (isNative && RNAsyncStorage) {
        await RNAsyncStorage.multiRemove(keys);
      } else {
        for (const key of keys) {
          localStorage.removeItem(key);
        }
      }
    } catch (error) {
      console.warn('AsyncStorage multiRemove error:', error);
    }
  },

  async multiGet(keys: string[]): Promise<[string, string | null][]> {
    try {
      if (isNative && RNAsyncStorage) {
        return await RNAsyncStorage.multiGet(keys);
      } else {
        return keys.map(key => [key, localStorage.getItem(key)]);
      }
    } catch (error) {
      console.warn('AsyncStorage multiGet error:', error);
      return keys.map(key => [key, null]);
    }
  },

  async multiSet(keyValuePairs: [string, string][]): Promise<void> {
    try {
      if (isNative && RNAsyncStorage) {
        await RNAsyncStorage.multiSet(keyValuePairs);
      } else {
        for (const [key, value] of keyValuePairs) {
          localStorage.setItem(key, value);
        }
      }
    } catch (error) {
      console.warn('AsyncStorage multiSet error:', error);
      throw error;
    }
  },

  // Platform-specific method to get storage info
  async getStorageInfo(): Promise<{ platform: string; estimatedSize?: number }> {
    try {
      if (isNative && RNAsyncStorage) {
        // Native app - much larger storage available
        return {
          platform: 'native',
          estimatedSize: 50 * 1024 * 1024 // ~50MB typical limit for React Native AsyncStorage
        };
      } else {
        // Web browser storage
        if ('storage' in navigator && 'estimate' in navigator.storage) {
          const estimate = await navigator.storage.estimate();
          return {
            platform: 'web',
            estimatedSize: estimate.quota || 10 * 1024 * 1024 // Default to 10MB if unknown
          };
        }
        return {
          platform: 'web',
          estimatedSize: 5 * 1024 * 1024 // Conservative 5MB estimate
        };
      }
    } catch (error) {
      console.warn('Error getting storage info:', error);
      return { platform: 'unknown' };
    }
  }
};

export default AsyncStorage;
