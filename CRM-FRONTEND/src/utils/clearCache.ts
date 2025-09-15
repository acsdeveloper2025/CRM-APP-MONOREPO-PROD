import { QueryClient } from '@tanstack/react-query';

/**
 * Utility functions to clear various types of cache and storage
 */

export const clearBrowserStorage = () => {
  try {
    // Clear localStorage
    localStorage.clear();
    console.log('✅ localStorage cleared');
    
    // Clear sessionStorage
    sessionStorage.clear();
    console.log('✅ sessionStorage cleared');
    
    // Clear IndexedDB (if used)
    if ('indexedDB' in window) {
      // Note: This is a simplified approach. In production, you might want to
      // specifically target your app's databases
      indexedDB.databases?.().then(databases => {
        databases.forEach(db => {
          if (db.name?.includes('crm') || db.name?.includes('app')) {
            indexedDB.deleteDatabase(db.name);
            console.log(`✅ IndexedDB ${db.name} cleared`);
          }
        });
      });
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error clearing browser storage:', error);
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

export const clearServiceWorkerCache = async () => {
  try {
    if ('serviceWorker' in navigator && 'caches' in window) {
      const cacheNames = await caches.keys();
      
      await Promise.all(
        cacheNames.map(cacheName => {
          console.log(`🗑️ Deleting cache: ${cacheName}`);
          return caches.delete(cacheName);
        })
      );
      
      console.log('✅ Service Worker caches cleared');
      return true;
    } else {
      console.log('ℹ️ Service Worker or Cache API not supported');
      return true;
    }
  } catch (error) {
    console.error('❌ Error clearing Service Worker cache:', error);
    return false;
  }
};

export const clearAllFrontendCache = async (queryClient: QueryClient) => {
  console.log('🧹 Starting frontend cache clearing...');
  
  const results = {
    browserStorage: false,
    reactQuery: false,
    serviceWorker: false,
  };
  
  // Clear browser storage
  results.browserStorage = clearBrowserStorage();
  
  // Clear React Query cache
  results.reactQuery = clearReactQueryCache(queryClient);
  
  // Clear Service Worker cache
  results.serviceWorker = await clearServiceWorkerCache();
  
  const allSuccessful = Object.values(results).every(result => result);
  
  if (allSuccessful) {
    console.log('🎉 All frontend caches cleared successfully!');
    console.log('🔄 Please refresh the page to see changes');
  } else {
    console.warn('⚠️ Some caches could not be cleared:', results);
  }
  
  return results;
};

// Specific cache clearing functions for different data types
export const clearCaseCache = (queryClient: QueryClient) => {
  queryClient.removeQueries({ queryKey: ['cases'] });
  queryClient.removeQueries({ queryKey: ['case'] });
  queryClient.invalidateQueries({ queryKey: ['cases'] });
  queryClient.invalidateQueries({ queryKey: ['case'] });
  console.log('✅ Case cache cleared');
};

export const clearFormCache = (queryClient: QueryClient) => {
  queryClient.removeQueries({ queryKey: ['case-form-submissions'] });
  queryClient.removeQueries({ queryKey: ['form-template'] });
  queryClient.removeQueries({ queryKey: ['auto-saved-form'] });
  queryClient.invalidateQueries({ queryKey: ['case-form-submissions'] });
  queryClient.invalidateQueries({ queryKey: ['form-template'] });
  queryClient.invalidateQueries({ queryKey: ['auto-saved-form'] });
  console.log('✅ Form cache cleared');
};

export const clearAttachmentCache = (queryClient: QueryClient) => {
  queryClient.removeQueries({ queryKey: ['attachments'] });
  queryClient.invalidateQueries({ queryKey: ['attachments'] });
  console.log('✅ Attachment cache cleared');
};

export const clearUserCache = (queryClient: QueryClient) => {
  queryClient.removeQueries({ queryKey: ['user'] });
  queryClient.removeQueries({ queryKey: ['users'] });
  queryClient.invalidateQueries({ queryKey: ['user'] });
  queryClient.invalidateQueries({ queryKey: ['users'] });
  console.log('✅ User cache cleared');
};

// Development helper function
export const clearAllAppData = async (queryClient: QueryClient) => {
  console.log('🚨 CLEARING ALL APPLICATION DATA - USE WITH CAUTION!');
  
  // Clear all specific caches
  clearCaseCache(queryClient);
  clearFormCache(queryClient);
  clearAttachmentCache(queryClient);
  clearUserCache(queryClient);
  
  // Clear all frontend cache
  await clearAllFrontendCache(queryClient);
  
  console.log('💥 All application data cleared!');
  console.log('🔄 Page will reload in 3 seconds...');
  
  // Auto-reload after clearing
  setTimeout(() => {
    window.location.reload();
  }, 3000);
};

// Export a hook for easy use in components
export const useCacheClearer = () => {
  const clearCache = async (queryClient: QueryClient, type: 'all' | 'cases' | 'forms' | 'attachments' | 'users' = 'all') => {
    switch (type) {
      case 'cases':
        clearCaseCache(queryClient);
        break;
      case 'forms':
        clearFormCache(queryClient);
        break;
      case 'attachments':
        clearAttachmentCache(queryClient);
        break;
      case 'users':
        clearUserCache(queryClient);
        break;
      case 'all':
      default:
        await clearAllAppData(queryClient);
        break;
    }
  };
  
  return { clearCache };
};
