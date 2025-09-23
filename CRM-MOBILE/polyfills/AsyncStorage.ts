// Mobile-optimized AsyncStorage with fallback for web
const AsyncStorage = {
  async getItem(key: string): Promise<string | null> {
    try {
      // Always use localStorage for web-based mobile app
      return localStorage.getItem(key);
    } catch (error) {
      console.warn('AsyncStorage getItem error:', error);
      return null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    try {
      // Use localStorage for web-based mobile app
      localStorage.setItem(key, value);
      console.log(`🌐 Web storage: Saved ${value.length} characters for key: ${key}`);
    } catch (error) {
      console.error('AsyncStorage setItem error:', error);
      throw error; // Re-throw to trigger quota exceeded handling
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.warn('AsyncStorage removeItem error:', error);
    }
  },

  async clear(): Promise<void> {
    try {
      localStorage.clear();
    } catch (error) {
      console.warn('AsyncStorage clear error:', error);
    }
  },

  async getAllKeys(): Promise<string[]> {
    try {
      return Object.keys(localStorage);
    } catch (error) {
      console.warn('AsyncStorage getAllKeys error:', error);
      return [];
    }
  },

  async multiRemove(keys: string[]): Promise<void> {
    try {
      for (const key of keys) {
        localStorage.removeItem(key);
      }
    } catch (error) {
      console.warn('AsyncStorage multiRemove error:', error);
    }
  },

  async multiGet(keys: string[]): Promise<[string, string | null][]> {
    try {
      return keys.map(key => [key, localStorage.getItem(key)]);
    } catch (error) {
      console.warn('AsyncStorage multiGet error:', error);
      return keys.map(key => [key, null]);
    }
  },

  async multiSet(keyValuePairs: [string, string][]): Promise<void> {
    try {
      for (const [key, value] of keyValuePairs) {
        localStorage.setItem(key, value);
      }
    } catch (error) {
      console.warn('AsyncStorage multiSet error:', error);
      throw error;
    }
  },

  // Mobile-specific method to get storage info
  async getStorageInfo(): Promise<{ platform: string; estimatedSize?: number }> {
    try {
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
    } catch (error) {
      console.warn('Error getting storage info:', error);
      return { platform: 'unknown' };
    }
  }
};

export default AsyncStorage;
