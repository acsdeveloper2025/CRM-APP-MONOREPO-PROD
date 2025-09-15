import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system';
import { QueryClient } from '@tanstack/react-query';

/**
 * Mobile cache clearing utilities for React Native/Expo
 */

export const clearAsyncStorage = async () => {
  try {
    await AsyncStorage.clear();
    console.log('✅ AsyncStorage cleared');
    return true;
  } catch (error) {
    console.error('❌ Error clearing AsyncStorage:', error);
    return false;
  }
};

export const clearSecureStore = async () => {
  try {
    // Get all keys and delete them
    // Note: SecureStore doesn't have a clear all method, so we need to track keys
    const keysToDelete = [
      'authToken',
      'refreshToken',
      'userCredentials',
      'deviceId',
      'lastSyncTime',
      'offlineQueue',
      'formDrafts',
      'caseCache',
      'attachmentCache',
    ];
    
    for (const key of keysToDelete) {
      try {
        await SecureStore.deleteItemAsync(key);
        console.log(`✅ SecureStore key '${key}' deleted`);
      } catch (error) {
        // Key might not exist, which is fine
        console.log(`ℹ️ SecureStore key '${key}' not found or already deleted`);
      }
    }
    
    console.log('✅ SecureStore cleared');
    return true;
  } catch (error) {
    console.error('❌ Error clearing SecureStore:', error);
    return false;
  }
};

export const clearFileSystemCache = async () => {
  try {
    const cacheDir = FileSystem.cacheDirectory;
    if (cacheDir) {
      // Clear image cache
      const imageCacheDir = `${cacheDir}images/`;
      if (await FileSystem.getInfoAsync(imageCacheDir).then(info => info.exists)) {
        await FileSystem.deleteAsync(imageCacheDir, { idempotent: true });
        console.log('✅ Image cache cleared');
      }
      
      // Clear document cache
      const docCacheDir = `${cacheDir}documents/`;
      if (await FileSystem.getInfoAsync(docCacheDir).then(info => info.exists)) {
        await FileSystem.deleteAsync(docCacheDir, { idempotent: true });
        console.log('✅ Document cache cleared');
      }
      
      // Clear temp files
      const tempDir = `${cacheDir}temp/`;
      if (await FileSystem.getInfoAsync(tempDir).then(info => info.exists)) {
        await FileSystem.deleteAsync(tempDir, { idempotent: true });
        console.log('✅ Temp files cleared');
      }
    }
    
    console.log('✅ File system cache cleared');
    return true;
  } catch (error) {
    console.error('❌ Error clearing file system cache:', error);
    return false;
  }
};

export const clearReactQueryCache = (queryClient: QueryClient) => {
  try {
    // Clear all queries
    queryClient.clear();
    console.log('✅ React Query cache cleared');
    
    // Invalidate all queries to force refetch
    queryClient.invalidateQueries();
    console.log('✅ All queries invalidated');
    
    return true;
  } catch (error) {
    console.error('❌ Error clearing React Query cache:', error);
    return false;
  }
};

export const clearOfflineQueue = async () => {
  try {
    // Clear offline form submissions queue
    await AsyncStorage.removeItem('offlineFormSubmissions');
    await AsyncStorage.removeItem('offlineAttachments');
    await AsyncStorage.removeItem('offlineLocationUpdates');
    await AsyncStorage.removeItem('pendingSyncItems');
    
    console.log('✅ Offline queue cleared');
    return true;
  } catch (error) {
    console.error('❌ Error clearing offline queue:', error);
    return false;
  }
};

export const clearFormDrafts = async () => {
  try {
    // Clear saved form drafts
    const keys = await AsyncStorage.getAllKeys();
    const draftKeys = keys.filter(key => key.startsWith('formDraft_'));
    
    if (draftKeys.length > 0) {
      await AsyncStorage.multiRemove(draftKeys);
      console.log(`✅ ${draftKeys.length} form drafts cleared`);
    } else {
      console.log('ℹ️ No form drafts found');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error clearing form drafts:', error);
    return false;
  }
};

export const clearCaseCache = async (queryClient: QueryClient) => {
  try {
    // Clear React Query case cache
    queryClient.removeQueries({ queryKey: ['cases'] });
    queryClient.removeQueries({ queryKey: ['case'] });
    queryClient.removeQueries({ queryKey: ['assignedCases'] });
    
    // Clear AsyncStorage case cache
    const keys = await AsyncStorage.getAllKeys();
    const caseKeys = keys.filter(key => 
      key.startsWith('case_') || 
      key.startsWith('caseList_') ||
      key.startsWith('caseDetails_')
    );
    
    if (caseKeys.length > 0) {
      await AsyncStorage.multiRemove(caseKeys);
      console.log(`✅ ${caseKeys.length} cached cases cleared`);
    }
    
    console.log('✅ Case cache cleared');
    return true;
  } catch (error) {
    console.error('❌ Error clearing case cache:', error);
    return false;
  }
};

export const clearAllMobileCache = async (queryClient: QueryClient) => {
  console.log('🧹 Starting mobile cache clearing...');
  
  const results = {
    asyncStorage: false,
    secureStore: false,
    fileSystem: false,
    reactQuery: false,
    offlineQueue: false,
    formDrafts: false,
    caseCache: false,
  };
  
  // Clear AsyncStorage
  results.asyncStorage = await clearAsyncStorage();
  
  // Clear SecureStore
  results.secureStore = await clearSecureStore();
  
  // Clear file system cache
  results.fileSystem = await clearFileSystemCache();
  
  // Clear React Query cache
  results.reactQuery = clearReactQueryCache(queryClient);
  
  // Clear offline queue
  results.offlineQueue = await clearOfflineQueue();
  
  // Clear form drafts
  results.formDrafts = await clearFormDrafts();
  
  // Clear case cache
  results.caseCache = await clearCaseCache(queryClient);
  
  const allSuccessful = Object.values(results).every(result => result);
  
  if (allSuccessful) {
    console.log('🎉 All mobile caches cleared successfully!');
    console.log('🔄 Please restart the app to see changes');
  } else {
    console.warn('⚠️ Some caches could not be cleared:', results);
  }
  
  return results;
};

// Specific cache clearing functions
export const clearUserSession = async () => {
  try {
    await SecureStore.deleteItemAsync('authToken');
    await SecureStore.deleteItemAsync('refreshToken');
    await SecureStore.deleteItemAsync('userCredentials');
    await AsyncStorage.removeItem('currentUser');
    await AsyncStorage.removeItem('userPreferences');
    
    console.log('✅ User session cleared');
    return true;
  } catch (error) {
    console.error('❌ Error clearing user session:', error);
    return false;
  }
};

export const clearLocationCache = async () => {
  try {
    await AsyncStorage.removeItem('lastKnownLocation');
    await AsyncStorage.removeItem('locationHistory');
    await AsyncStorage.removeItem('offlineLocationUpdates');
    
    console.log('✅ Location cache cleared');
    return true;
  } catch (error) {
    console.error('❌ Error clearing location cache:', error);
    return false;
  }
};

// Development helper - clears everything except auth tokens
export const clearAllAppDataKeepAuth = async (queryClient: QueryClient) => {
  console.log('🚨 CLEARING ALL APP DATA (KEEPING AUTH) - USE WITH CAUTION!');
  
  const results = {
    caseCache: false,
    formDrafts: false,
    offlineQueue: false,
    fileSystem: false,
    reactQuery: false,
    locationCache: false,
  };
  
  // Clear specific data but keep auth
  results.caseCache = await clearCaseCache(queryClient);
  results.formDrafts = await clearFormDrafts();
  results.offlineQueue = await clearOfflineQueue();
  results.fileSystem = await clearFileSystemCache();
  results.reactQuery = clearReactQueryCache(queryClient);
  results.locationCache = await clearLocationCache();
  
  console.log('💥 App data cleared (auth preserved)!');
  return results;
};

// Hook for easy use in components
export const useMobileCacheClearer = () => {
  const clearCache = async (
    queryClient: QueryClient, 
    type: 'all' | 'cases' | 'forms' | 'files' | 'auth' | 'location' | 'keepAuth' = 'all'
  ) => {
    switch (type) {
      case 'cases':
        return await clearCaseCache(queryClient);
      case 'forms':
        return await clearFormDrafts();
      case 'files':
        return await clearFileSystemCache();
      case 'auth':
        return await clearUserSession();
      case 'location':
        return await clearLocationCache();
      case 'keepAuth':
        return await clearAllAppDataKeepAuth(queryClient);
      case 'all':
      default:
        return await clearAllMobileCache(queryClient);
    }
  };
  
  return { clearCache };
};
