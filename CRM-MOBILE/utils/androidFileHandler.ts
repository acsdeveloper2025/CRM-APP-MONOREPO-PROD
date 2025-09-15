import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';

/**
 * Android-specific file handling utilities
 * Ensures images are stored only in app's internal storage, not in gallery
 */

export interface AndroidFileOptions {
  filename: string;
  data: string;
  directory?: Directory;
}

/**
 * Save image data to Android app's internal storage
 * This prevents images from appearing in the device gallery
 */
export const saveImageToInternalStorage = async (options: AndroidFileOptions): Promise<string> => {
  try {
    if (Capacitor.getPlatform() !== 'android') {
      throw new Error('This function is only for Android platform');
    }

    console.log('📱 Saving image to Android internal storage:', options.filename);

    const result = await Filesystem.writeFile({
      path: options.filename,
      data: options.data,
      directory: options.directory || Directory.Data, // Use app's internal data directory
      recursive: true
    });

    console.log('✅ Image saved to Android internal storage:', result.uri);
    return result.uri;
  } catch (error) {
    console.error('❌ Failed to save image to Android internal storage:', error);
    throw error;
  }
};

/**
 * Read image from Android app's internal storage
 */
export const readImageFromInternalStorage = async (filename: string, directory?: Directory): Promise<string> => {
  try {
    if (Capacitor.getPlatform() !== 'android') {
      throw new Error('This function is only for Android platform');
    }

    console.log('📱 Reading image from Android internal storage:', filename);

    const result = await Filesystem.readFile({
      path: filename,
      directory: directory || Directory.Data
    });

    console.log('✅ Image read from Android internal storage');
    return result.data as string;
  } catch (error) {
    console.error('❌ Failed to read image from Android internal storage:', error);
    throw error;
  }
};

/**
 * Delete image from Android app's internal storage
 */
export const deleteImageFromInternalStorage = async (filename: string, directory?: Directory): Promise<void> => {
  try {
    if (Capacitor.getPlatform() !== 'android') {
      throw new Error('This function is only for Android platform');
    }

    console.log('📱 Deleting image from Android internal storage:', filename);

    await Filesystem.deleteFile({
      path: filename,
      directory: directory || Directory.Data
    });

    console.log('✅ Image deleted from Android internal storage');
  } catch (error) {
    console.error('❌ Failed to delete image from Android internal storage:', error);
    throw error;
  }
};

/**
 * Check if file exists in Android app's internal storage
 */
export const checkImageExistsInInternalStorage = async (filename: string, directory?: Directory): Promise<boolean> => {
  try {
    if (Capacitor.getPlatform() !== 'android') {
      return false;
    }

    const result = await Filesystem.stat({
      path: filename,
      directory: directory || Directory.Data
    });

    return result.type === 'file';
  } catch (error) {
    return false;
  }
};

/**
 * Get Android app's internal storage info
 */
export const getAndroidStorageInfo = async (): Promise<any> => {
  try {
    if (Capacitor.getPlatform() !== 'android') {
      throw new Error('This function is only for Android platform');
    }

    // Get available storage space
    const dataDir = await Filesystem.readdir({
      path: '',
      directory: Directory.Data
    });

    console.log('📱 Android internal storage contents:', dataDir);
    return dataDir;
  } catch (error) {
    console.error('❌ Failed to get Android storage info:', error);
    throw error;
  }
};

/**
 * Clean up old images from Android internal storage
 * Useful for managing storage space
 */
export const cleanupOldImages = async (maxAgeInDays: number = 30): Promise<void> => {
  try {
    if (Capacitor.getPlatform() !== 'android') {
      return;
    }

    console.log('📱 Cleaning up old images from Android internal storage...');

    const files = await Filesystem.readdir({
      path: '',
      directory: Directory.Data
    });

    const cutoffTime = Date.now() - (maxAgeInDays * 24 * 60 * 60 * 1000);

    for (const file of files.files) {
      if (file.name.match(/\.(jpg|jpeg|png|webp)$/i)) {
        try {
          const stat = await Filesystem.stat({
            path: file.name,
            directory: Directory.Data
          });

          if (stat.mtime && stat.mtime < cutoffTime) {
            await deleteImageFromInternalStorage(file.name);
            console.log('🗑️ Deleted old image:', file.name);
          }
        } catch (error) {
          console.warn('⚠️ Failed to check/delete file:', file.name, error);
        }
      }
    }

    console.log('✅ Android internal storage cleanup completed');
  } catch (error) {
    console.error('❌ Failed to cleanup Android internal storage:', error);
  }
};
