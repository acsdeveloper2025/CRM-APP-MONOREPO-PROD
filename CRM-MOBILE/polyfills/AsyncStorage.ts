// Mobile-optimized AsyncStorage with fallback for web
const AsyncStorage = {
  async getItem(key: string): Promise<string | null> {
    try {
      // Check if we're in a React Native environment
      if (typeof window !== 'undefined' && window.ReactNativeWebView) {
        // Mobile app environment - use React Native AsyncStorage
        const RNAsyncStorage = require('@react-native-async-storage/async-storage').default;
        return await RNAsyncStorage.getItem(key);
      } else {
        // Web environment - use localStorage
        return localStorage.getItem(key);
      }
    } catch (error) {
      console.warn('AsyncStorage getItem error:', error);
      return null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    try {
      // Check if we're in a React Native environment
      if (typeof window !== 'undefined' && window.ReactNativeWebView) {
        // Mobile app environment - use React Native AsyncStorage (much larger limits)
        const RNAsyncStorage = require('@react-native-async-storage/async-storage').default;
        await RNAsyncStorage.setItem(key, value);
        console.log(`📱 Mobile storage: Saved ${value.length} characters for key: ${key}`);
      } else {
        // Web environment - use localStorage (limited to ~5-10MB)
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
      if (typeof window !== 'undefined' && window.ReactNativeWebView) {
        const RNAsyncStorage = require('@react-native-async-storage/async-storage').default;
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
      if (typeof window !== 'undefined' && window.ReactNativeWebView) {
        const RNAsyncStorage = require('@react-native-async-storage/async-storage').default;
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
      if (typeof window !== 'undefined' && window.ReactNativeWebView) {
        const RNAsyncStorage = require('@react-native-async-storage/async-storage').default;
        return await RNAsyncStorage.getAllKeys();
      } else {
        return Object.keys(localStorage);
      }
    } catch (error) {
      console.warn('AsyncStorage getAllKeys error:', error);
      return [];
    }
  },

  // Mobile-specific method to get storage info
  async getStorageInfo(): Promise<{ platform: string; estimatedSize?: number }> {
    try {
      if (typeof window !== 'undefined' && window.ReactNativeWebView) {
        // Mobile app - much larger storage available
        return {
          platform: 'mobile',
          estimatedSize: 50 * 1024 * 1024 // ~50MB typical limit for React Native AsyncStorage
        };
      } else {
        // Web browser - limited storage
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
