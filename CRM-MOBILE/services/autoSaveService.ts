import { encryptedStorage } from './encryptedStorage';
import { Case, CapturedImage } from '../types';

/**
 * Auto-save service for form data with encrypted local storage
 */
export interface AutoSaveData {
  caseId: string;
  formType: string;
  formData: any;
  images: CapturedImage[];
  lastSaved: string;
  version: number;
  isComplete: boolean;

  metadata: {
    userAgent: string;
    timestamp: string;
    formVersion: string;
  };
  // Browser optimization properties
  platform?: string;
  storageVersion?: string;
  hasChunkedImages?: boolean;
  imageCount?: number;
  imagesSkipped?: boolean;
  skippedImageCount?: number;
  isMinimal?: boolean;
  originalDataSize?: number;
  restoredFromChunks?: boolean;
  imageRestorationFailed?: boolean;
}

export interface AutoSaveOptions {
  debounceMs?: number;
  maxRetries?: number;
  enableCompression?: boolean;
}

class AutoSaveService {
  private readonly AUTOSAVE_PREFIX = 'autosave_';
  private readonly CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
  private readonly MAX_AUTOSAVE_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

  private readonly CURRENT_VERSION = 1;
  
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private saveQueue: Map<string, AutoSaveData> = new Map();
  private isProcessing = false;
  private listeners: Map<string, ((data: AutoSaveData | null) => void)[]> = new Map();

  constructor() {
    this.startCleanupInterval();
    this.handleVisibilityChange();
    this.handleBeforeUnload();
  }

  /**
   * Save form data with auto-save
   */
  async saveFormData(
    caseId: string,
    formType: string,
    formData: any,
    images: CapturedImage[] = [],
    options: AutoSaveOptions = {}
  ): Promise<void> {
    const { debounceMs = 1000 } = options;
    const key = this.getAutoSaveKeyInternal(caseId, formType);

    // Create auto-save data
    const autoSaveData: AutoSaveData = {
      caseId,
      formType,
      formData: this.sanitizeFormData(formData),
      images,
      lastSaved: new Date().toISOString(),
      version: this.CURRENT_VERSION,
      isComplete: false,
      metadata: {
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
        formVersion: '1.0.0'
      }
    };

    // Add to save queue
    this.saveQueue.set(key, autoSaveData);

    // Clear existing debounce timer
    const existingTimer = this.debounceTimers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new debounce timer
    const timer = setTimeout(async () => {
      await this.processSaveQueue(key);
      this.debounceTimers.delete(key);
    }, debounceMs);

    this.debounceTimers.set(key, timer);

    // Notify listeners
    this.notifyListeners(key, autoSaveData);
  }

  /**
   * Process the save queue with mobile-optimized storage
   */
  private async processSaveQueue(key: string): Promise<void> {
    if (this.isProcessing) return;

    this.isProcessing = true;
    try {
      const data = this.saveQueue.get(key);
      if (data) {
        // Get storage platform info
        const storageInfo = await this.getStorageInfo();

        try {
          // For mobile apps, we can store much larger data directly
          if (storageInfo.platform === 'mobile') {
            await encryptedStorage.setItem(key, data);
            this.saveQueue.delete(key);
            console.log(`📱 Mobile auto-save: Saved complete form with images for ${data.caseId} (${data.formType}) - Size: ${JSON.stringify(data).length} chars`);
          } else {
            // For web, use optimized storage strategy
            const optimizedData = await this.optimizeDataForStorage(data);
            await encryptedStorage.setItem(key, optimizedData);
            this.saveQueue.delete(key);
            console.log(`🌐 Web auto-save: Saved optimized form for ${data.caseId} (${data.formType}) - Size: ${JSON.stringify(optimizedData).length} chars`);
          }
        } catch (storageError: any) {
          if (storageError.name === 'QuotaExceededError') {
            console.warn(`⚠️ Storage quota exceeded for ${data.caseId}, using fallback strategy...`);
            await this.handleStorageQuotaExceeded(key, data, storageInfo);
          } else {
            throw storageError;
          }
        }
      }
    } catch (error) {
      console.error('❌ Error processing save queue:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Retrieve saved form data with mobile/web compatibility
   */
  async getFormData(caseId: string, formType: string): Promise<AutoSaveData | null> {
    try {
      const key = this.getAutoSaveKeyInternal(caseId, formType);
      const data = await encryptedStorage.getItem<AutoSaveData>(key);

      if (data && this.isValidAutoSaveData(data)) {
        // Check if this is chunked storage (web fallback)
        if (data.hasChunkedImages) {
          console.log(`🔄 Restoring chunked images for ${caseId}`);
          return await this.restoreChunkedImages(key, data);
        }

        // Check if images were skipped (web fallback)
        if (data.imagesSkipped) {
          console.log(`⚠️ Form ${caseId} was saved without images due to storage constraints`);
        }

        // Check if this is minimal data (last resort fallback)
        if (data.isMinimal) {
          console.log(`⚠️ Form ${caseId} has minimal data only due to storage constraints`);
        }

        console.log(`✅ Retrieved auto-save data for ${caseId} (${data.platform || 'unknown'} platform)`);
        return data;
      }

      return null;
    } catch (error) {
      console.error('Error retrieving auto-save data:', error);
      return null;
    }
  }

  /**
   * Check if auto-saved data exists for a form
   */
  async hasAutoSaveData(caseId: string, formType: string): Promise<boolean> {
    try {
      const data = await this.getFormData(caseId, formType);
      return data !== null;
    } catch (error) {
      return false;
    }
  }

  /**
   * Mark form as completed and clean up auto-save data after 15 days
   */
  async markFormCompleted(caseId: string, formType: string): Promise<void> {
    try {
      const key = this.getAutoSaveKeyInternal(caseId, formType);
      const data = await this.getFormData(caseId, formType);

      if (data) {
        data.isComplete = true;
        data.lastSaved = new Date().toISOString();
        await encryptedStorage.setItem(key, data);
      }

      // Schedule cleanup after a delay
      setTimeout(() => {
        this.removeAutoSaveData(caseId, formType);
      }, 5000); // 5 seconds delay

    } catch (error) {
      console.error('Error marking form as completed:', error);
    }
  }



  /**
   * Remove auto-save data
   */
  async removeAutoSaveData(caseId: string, formType: string): Promise<void> {
    try {
      const key = this.getAutoSaveKeyInternal(caseId, formType);
      await encryptedStorage.removeItem(key);

      // Clear any pending saves
      this.saveQueue.delete(key);
      const timer = this.debounceTimers.get(key);
      if (timer) {
        clearTimeout(timer);
        this.debounceTimers.delete(key);
      }

      // Notify listeners
      this.notifyListeners(key, null);

      console.log(`Removed auto-save data for ${caseId} (${formType})`);
    } catch (error) {
      console.error('Error removing auto-save data:', error);
    }
  }

  /**
   * Get all auto-saved forms
   */
  async getAllAutoSavedForms(): Promise<AutoSaveData[]> {
    try {
      const keys = await encryptedStorage.getAllKeys();
      const autoSaveKeys = keys.filter(key => key.startsWith(this.AUTOSAVE_PREFIX));
      
      const autoSaveData: AutoSaveData[] = [];
      
      for (const key of autoSaveKeys) {
        const data = await encryptedStorage.getItem<AutoSaveData>(key);
        if (data && this.isValidAutoSaveData(data) && !data.isComplete) {
          autoSaveData.push(data);
        }
      }
      
      // Sort by last saved (most recent first)
      return autoSaveData.sort((a, b) => 
        new Date(b.lastSaved).getTime() - new Date(a.lastSaved).getTime()
      );
    } catch (error) {
      console.error('Error getting all auto-saved forms:', error);
      return [];
    }
  }

  /**
   * Force save all pending data
   */
  async forceSaveAll(): Promise<void> {
    try {
      // Clear all debounce timers and process immediately
      for (const [key, timer] of this.debounceTimers.entries()) {
        clearTimeout(timer);
        await this.processSaveQueue(key);
      }
      this.debounceTimers.clear();
    } catch (error) {
      console.error('Error force saving all data:', error);
    }
  }

  /**
   * Clean up old auto-save data
   */
  async cleanup(): Promise<void> {
    try {
      const keys = await encryptedStorage.getAllKeys();
      const autoSaveKeys = keys.filter(key => key.startsWith(this.AUTOSAVE_PREFIX));
      const now = Date.now();

      for (const key of autoSaveKeys) {
        const data = await encryptedStorage.getItem<AutoSaveData>(key);
        if (data) {
          const lastSavedTime = new Date(data.lastSaved).getTime();
          const age = now - lastSavedTime;

          // Remove old or completed auto-save data
          if (age > this.MAX_AUTOSAVE_AGE || data.isComplete) {
            await encryptedStorage.removeItem(key);
            console.log(`Cleaned up old auto-save data: ${key}`);
          }
        }
      }
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }

  /**
   * Add listener for auto-save events
   */
  addListener(key: string, callback: (data: AutoSaveData | null) => void): void {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, []);
    }
    this.listeners.get(key)!.push(callback);
  }

  /**
   * Remove listener
   */
  removeListener(key: string, callback: (data: AutoSaveData | null) => void): void {
    const callbacks = this.listeners.get(key);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  /**
   * Get auto-save key for external use
   */
  getAutoSaveKey(caseId: string, formType: string): string {
    return this.getAutoSaveKeyInternal(caseId, formType);
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(): Promise<{
    totalAutoSaves: number;
    totalSize: string;
    oldestSave: string | null;
    newestSave: string | null;
  }> {
    try {
      const autoSaves = await this.getAllAutoSavedForms();
      const storageInfo = await encryptedStorage.getStorageInfo();
      
      const timestamps = autoSaves.map(save => new Date(save.lastSaved).getTime());
      
      return {
        totalAutoSaves: autoSaves.length,
        totalSize: storageInfo.estimatedSize,
        oldestSave: timestamps.length > 0 ? new Date(Math.min(...timestamps)).toISOString() : null,
        newestSave: timestamps.length > 0 ? new Date(Math.max(...timestamps)).toISOString() : null
      };
    } catch (error) {
      console.error('Error getting storage stats:', error);
      return {
        totalAutoSaves: 0,
        totalSize: '0 KB',
        oldestSave: null,
        newestSave: null
      };
    }
  }

  // Private helper methods
  private getAutoSaveKeyInternal(caseId: string, formType: string): string {
    return `${this.AUTOSAVE_PREFIX}${caseId}_${formType}`;
  }

  private sanitizeFormData(formData: any): any {
    // Remove any functions or non-serializable data
    return JSON.parse(JSON.stringify(formData));
  }

  private isValidAutoSaveData(data: any): data is AutoSaveData {
    return (
      data &&
      typeof data === 'object' &&
      typeof data.caseId === 'string' &&
      typeof data.formType === 'string' &&
      typeof data.lastSaved === 'string' &&
      typeof data.version === 'number' &&
      Array.isArray(data.images)
    );
  }

  private notifyListeners(key: string, data: AutoSaveData | null): void {
    const callbacks = this.listeners.get(key);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in auto-save listener:', error);
        }
      });
    }
  }

  private startCleanupInterval(): void {
    setInterval(() => {
      this.cleanup();
    }, this.CLEANUP_INTERVAL);
  }

  private handleVisibilityChange(): void {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        // Page is being hidden, force save all pending data
        this.forceSaveAll();
      }
    });
  }

  private handleBeforeUnload(): void {
    window.addEventListener('beforeunload', () => {
      // Force save all pending data before page unload
      this.forceSaveAll();
    });
  }

  /**
   * Get storage platform information
   */
  private async getStorageInfo(): Promise<{ platform: string; estimatedSize?: number }> {
    try {
      // Import AsyncStorage to get platform info
      const AsyncStorage = (await import('../polyfills/AsyncStorage')).default;
      return await AsyncStorage.getStorageInfo();
    } catch (error) {
      console.warn('Error getting storage info:', error);
      return { platform: 'unknown' };
    }
  }

  /**
   * Handle storage quota exceeded with platform-specific strategies
   */
  private async handleStorageQuotaExceeded(key: string, data: any, storageInfo: any): Promise<void> {
    try {
      if (storageInfo.platform === 'mobile') {
        // Mobile apps rarely hit quota limits, but if they do, clean up old data
        console.log(`📱 Mobile storage cleanup for ${data.caseId}`);
        await this.cleanupOldAutoSaveData();

        // Retry with full data
        await encryptedStorage.setItem(key, data);
        this.saveQueue.delete(key);
        console.log(`✅ Mobile retry successful for ${data.caseId}`);
      } else {
        // Web browser - use chunked storage strategy
        console.log(`🌐 Web storage fallback for ${data.caseId}`);
        await this.handleLargeFormStorage(key, data);
      }
    } catch (error) {
      console.error(`❌ Failed to handle storage quota exceeded for ${data.caseId}:`, error);
      // Last resort: store minimal data
      await this.storeMinimalFormData(key, data);
    }
  }

  /**
   * Optimize data for storage with advanced browser compression
   */
  private async optimizeDataForStorage(data: any): Promise<any> {
    try {
      // Create a copy to avoid modifying original data
      const optimizedData = { ...data };

      // Add storage metadata
      optimizedData.lastSaved = new Date().toISOString();
      optimizedData.storageVersion = '2.0';
      optimizedData.platform = 'web';

      // Advanced image optimization for browsers
      if (optimizedData.images && optimizedData.images.length > 0) {
        console.log(`🖼️ Optimizing ${optimizedData.images.length} regular images for browser storage...`);
        optimizedData.images = await this.optimizeImagesForBrowser(optimizedData.images, 'photos');
      }

      if (optimizedData.selfieImages && optimizedData.selfieImages.length > 0) {
        console.log(`🤳 Optimizing ${optimizedData.selfieImages.length} selfie images for browser storage...`);
        optimizedData.selfieImages = await this.optimizeImagesForBrowser(optimizedData.selfieImages, 'selfies');
      }

      const originalSize = JSON.stringify(data).length;
      const optimizedSize = JSON.stringify(optimizedData).length;
      const compressionRatio = ((originalSize - optimizedSize) / originalSize * 100).toFixed(1);

      console.log(`📊 Browser optimization complete for ${data.caseId}:`);
      console.log(`   Original: ${originalSize} chars`);
      console.log(`   Optimized: ${optimizedSize} chars`);
      console.log(`   Compression: ${compressionRatio}% reduction`);

      return optimizedData;
    } catch (error) {
      console.error('❌ Error optimizing data for storage:', error);
      return data; // Return original data if optimization fails
    }
  }

  /**
   * Advanced image optimization for browser storage
   */
  private async optimizeImagesForBrowser(images: CapturedImage[], type: string): Promise<CapturedImage[]> {
    const optimizedImages: CapturedImage[] = [];

    for (let i = 0; i < images.length; i++) {
      try {
        const image = images[i];
        if (!image || !image.dataUrl) continue;

        // Compress image for browser storage
        const compressedImage = await this.compressImageForBrowser(image);
        optimizedImages.push(compressedImage);

        const originalSize = image.dataUrl.length;
        const compressedSize = compressedImage.dataUrl.length;
        const reduction = ((originalSize - compressedSize) / originalSize * 100).toFixed(1);

        console.log(`   ${type} ${i + 1}: ${originalSize} → ${compressedSize} chars (${reduction}% reduction)`);
      } catch (error) {
        console.warn(`⚠️ Failed to optimize ${type} image ${i + 1}, keeping original`);
        optimizedImages.push(images[i]);
      }
    }

    return optimizedImages;
  }

  /**
   * Compress individual image for browser storage
   */
  private async compressImageForBrowser(image: CapturedImage): Promise<CapturedImage> {
    return new Promise((resolve) => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();

        img.onload = () => {
          // Calculate optimal dimensions (max 800px width/height for browser storage)
          const maxDimension = 800;
          let { width, height } = img;

          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = (height * maxDimension) / width;
              width = maxDimension;
            } else {
              width = (width * maxDimension) / height;
              height = maxDimension;
            }
          }

          canvas.width = width;
          canvas.height = height;

          // Draw and compress
          ctx?.drawImage(img, 0, 0, width, height);

          // Use JPEG compression for better file size (quality: 0.7 for good balance)
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);

          resolve({
            ...image,
            dataUrl: compressedDataUrl,
            compressed: true,
            originalSize: image.dataUrl.length,
            compressedSize: compressedDataUrl.length
          });
        };

        img.onerror = () => {
          console.warn('Failed to load image for compression, keeping original');
          resolve(image);
        };

        img.src = image.dataUrl;
      } catch (error) {
        console.warn('Error compressing image, keeping original:', error);
        resolve(image);
      }
    });
  }

  /**
   * Smart storage management for large forms with images
   */
  private async handleLargeFormStorage(key: string, data: any): Promise<void> {
    try {
      console.log(`🔧 Implementing smart storage for large form: ${data.caseId}`);

      // Strategy 1: Clean up old auto-save data first
      await this.cleanupOldAutoSaveData();

      // Strategy 2: Try chunked storage for images
      const success = await this.storeFormWithChunkedImages(key, data);

      if (success) {
        this.saveQueue.delete(key);
        console.log(`✅ Successfully stored large form using chunked strategy: ${data.caseId}`);
      } else {
        // Strategy 3: Store form data without images as fallback
        await this.storeFormDataOnly(key, data);
        console.log(`⚠️ Stored form data without images due to storage constraints: ${data.caseId}`);
      }
    } catch (error) {
      console.error(`❌ Failed to store large form ${data.caseId}:`, error);
      // Last resort: store minimal form data
      await this.storeMinimalFormData(key, data);
    }
  }

  /**
   * Store form with images using chunked approach
   */
  private async storeFormWithChunkedImages(key: string, data: any): Promise<boolean> {
    try {
      // Separate form data from images
      const { images, selfieImages, ...formDataOnly } = data;
      const allImages = [...(images || []), ...(selfieImages || [])];

      // Store form data first
      await encryptedStorage.setItem(key, {
        ...formDataOnly,
        hasChunkedImages: true,
        imageCount: allImages.length,
        lastSaved: new Date().toISOString()
      });

      // Store images in separate chunks
      for (let i = 0; i < allImages.length; i++) {
        const imageKey = `${key}_image_${i}`;
        try {
          await encryptedStorage.setItem(imageKey, {
            imageData: allImages[i],
            index: i,
            isRegularImage: i < (images?.length || 0)
          });
        } catch (imageError) {
          console.warn(`⚠️ Failed to store image ${i} for ${data.caseId}, continuing...`);
          // Continue with other images even if one fails
        }
      }

      console.log(`📸 Stored ${allImages.length} images in chunks for ${data.caseId}`);
      return true;
    } catch (error) {
      console.error('❌ Chunked image storage failed:', error);
      return false;
    }
  }

  /**
   * Store form data without images
   */
  private async storeFormDataOnly(key: string, data: any): Promise<void> {
    const { images, selfieImages, ...formDataOnly } = data;
    await encryptedStorage.setItem(key, {
      ...formDataOnly,
      imagesSkipped: true,
      skippedImageCount: (images?.length || 0) + (selfieImages?.length || 0),
      lastSaved: new Date().toISOString()
    });
  }

  /**
   * Store minimal form data as last resort
   */
  private async storeMinimalFormData(key: string, data: any): Promise<void> {
    const minimalData = {
      caseId: data.caseId,
      formType: data.formType,
      lastSaved: new Date().toISOString(),
      isMinimal: true,
      originalDataSize: JSON.stringify(data).length
    };
    await encryptedStorage.setItem(key, minimalData);
    console.log(`💾 Stored minimal data for ${data.caseId} due to storage constraints`);
  }

  /**
   * Clean up old auto-save data to free space
   */
  private async cleanupOldAutoSaveData(): Promise<void> {
    try {
      const keys = await encryptedStorage.getAllKeys();
      const autoSaveKeys = keys.filter(key => key.includes('caseflow_encrypted_autosave_'));

      // Sort by last modified and remove oldest entries
      const keyDataPairs = await Promise.all(
        autoSaveKeys.map(async key => {
          try {
            const data = await encryptedStorage.getItem(key) as AutoSaveData | null;
            return { key, lastSaved: data?.lastSaved || '1970-01-01' };
          } catch {
            return { key, lastSaved: '1970-01-01' };
          }
        })
      );

      // Remove oldest 25% of auto-save entries
      keyDataPairs.sort((a, b) => a.lastSaved.localeCompare(b.lastSaved));
      const keysToRemove = keyDataPairs.slice(0, Math.floor(keyDataPairs.length * 0.25));

      for (const { key } of keysToRemove) {
        await encryptedStorage.removeItem(key);
        // Also remove any associated image chunks
        const imageKeys = keys.filter(k => k.startsWith(`${key}_image_`));
        for (const imageKey of imageKeys) {
          await encryptedStorage.removeItem(imageKey);
        }
      }

      console.log(`🧹 Cleaned up ${keysToRemove.length} old auto-save entries to free storage space`);
    } catch (error) {
      console.error('❌ Error during cleanup:', error);
    }
  }

  /**
   * Restore chunked images (web fallback strategy)
   */
  private async restoreChunkedImages(baseKey: string, formData: any): Promise<AutoSaveData> {
    try {
      const images: CapturedImage[] = [];
      const selfieImages: CapturedImage[] = [];

      // Restore images from chunks
      for (let i = 0; i < (formData.imageCount || 0); i++) {
        const imageKey = `${baseKey}_image_${i}`;
        try {
          const imageData = await encryptedStorage.getItem(imageKey) as {
            imageData: CapturedImage;
            index: number;
            isRegularImage: boolean;
          } | null;
          if (imageData && imageData.imageData) {
            if (imageData.isRegularImage) {
              images.push(imageData.imageData);
            } else {
              selfieImages.push(imageData.imageData);
            }
          }
        } catch {
          console.warn(`⚠️ Failed to restore image chunk ${i} for ${formData.caseId}`);
        }
      }

      // Combine form data with restored images
      const restoredData = {
        ...formData,
        images,
        selfieImages,
        hasChunkedImages: false, // Mark as restored
        restoredFromChunks: true
      };

      console.log(`📸 Restored ${images.length} photos and ${selfieImages.length} selfies from chunks for ${formData.caseId}`);
      return restoredData;
    } catch (error) {
      console.error('❌ Error restoring chunked images:', error);
      // Return form data without images if restoration fails
      return { ...formData, images: [], selfieImages: [], imageRestorationFailed: true };
    }
  }
}

// Export singleton instance
export const autoSaveService = new AutoSaveService();
