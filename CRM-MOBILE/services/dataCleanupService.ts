/**
 * Data Cleanup Service for CaseFlow Mobile
 * Manages automatic deletion of case data older than 45 days
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Preferences } from '@capacitor/preferences';

export interface CleanupResult {
  success: boolean;
  deletedCases: number;
  deletedFiles: number;
  deletedSize: number; // in bytes
  errors: string[];
  timestamp: string;
}

export interface CleanupConfig {
  retentionDays: number;
  enableNotifications: boolean;
  enableLogging: boolean;
  dryRun: boolean;
}

class DataCleanupService {
  private static instance: DataCleanupService;
  private readonly RETENTION_DAYS = 45;
  private readonly CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  private readonly STORAGE_KEYS = {
    LAST_CLEANUP: 'lastCleanupTimestamp',
    CLEANUP_ENABLED: 'cleanupEnabled',
    CLEANUP_LOGS: 'cleanupLogs',
    USER_NOTIFIED: 'userNotifiedAboutCleanup'
  };

  private config: CleanupConfig = {
    retentionDays: this.RETENTION_DAYS,
    enableNotifications: true,
    enableLogging: true,
    dryRun: false
  };

  private constructor() {}

  static getInstance(): DataCleanupService {
    if (!DataCleanupService.instance) {
      DataCleanupService.instance = new DataCleanupService();
    }
    return DataCleanupService.instance;
  }

  /**
   * Initialize the cleanup service
   */
  async initialize(): Promise<void> {
    try {
      console.log('🧹 Initializing Data Cleanup Service...');
      
      // Check if user has been notified about cleanup
      const userNotified = await this.getUserNotificationStatus();
      if (!userNotified) {
        await this.notifyUserAboutCleanup();
      }

      // Schedule daily cleanup checks
      await this.scheduleCleanupCheck();
      
      // Run initial cleanup check
      await this.checkAndCleanup();
      
      console.log('✅ Data Cleanup Service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Data Cleanup Service:', error);
    }
  }

  /**
   * Check if cleanup is needed and perform it
   */
  async checkAndCleanup(): Promise<CleanupResult> {
    try {
      const lastCleanup = await this.getLastCleanupTimestamp();
      const now = Date.now();
      const timeSinceLastCleanup = now - lastCleanup;

      // Check if 24 hours have passed since last cleanup
      if (timeSinceLastCleanup >= this.CLEANUP_INTERVAL) {
        console.log('🧹 Starting scheduled data cleanup...');
        return await this.performCleanup();
      } else {
        const hoursUntilNext = Math.ceil((this.CLEANUP_INTERVAL - timeSinceLastCleanup) / (60 * 60 * 1000));
        console.log(`⏰ Next cleanup in ${hoursUntilNext} hours`);
        
        return {
          success: true,
          deletedCases: 0,
          deletedFiles: 0,
          deletedSize: 0,
          errors: [],
          timestamp: new Date().toISOString()
        };
      }
    } catch (error) {
      console.error('❌ Cleanup check failed:', error);
      return {
        success: false,
        deletedCases: 0,
        deletedFiles: 0,
        deletedSize: 0,
        errors: [error.message],
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Perform the actual data cleanup
   */
  async performCleanup(): Promise<CleanupResult> {
    const result: CleanupResult = {
      success: true,
      deletedCases: 0,
      deletedFiles: 0,
      deletedSize: 0,
      errors: [],
      timestamp: new Date().toISOString()
    };

    try {
      console.log('🧹 Starting data cleanup process...');
      
      // 1. Clean up case data from AsyncStorage
      const storageResult = await this.cleanupStorageData();
      result.deletedCases += storageResult.deletedCases;
      result.errors.push(...storageResult.errors);

      // 2. Clean up cached files
      const filesResult = await this.cleanupCachedFiles();
      result.deletedFiles += filesResult.deletedFiles;
      result.deletedSize += filesResult.deletedSize;
      result.errors.push(...filesResult.errors);

      // 3. Clean up auto-save data
      const autoSaveResult = await this.cleanupAutoSaveData();
      result.deletedCases += autoSaveResult.deletedCases;
      result.errors.push(...autoSaveResult.errors);

      // 4. Clean up temporary data
      const tempResult = await this.cleanupTemporaryData();
      result.deletedFiles += tempResult.deletedFiles;
      result.deletedSize += tempResult.deletedSize;
      result.errors.push(...tempResult.errors);

      // Update last cleanup timestamp
      await this.updateLastCleanupTimestamp();

      // Log cleanup results
      await this.logCleanupResult(result);

      // Send notification if significant cleanup occurred
      if (result.deletedCases > 0 || result.deletedFiles > 0) {
        await this.sendCleanupNotification(result);
      }

      console.log('✅ Data cleanup completed:', result);
      return result;

    } catch (error) {
      console.error('❌ Data cleanup failed:', error);
      result.success = false;
      result.errors.push(error.message);
      return result;
    }
  }

  /**
   * Clean up case data from AsyncStorage
   */
  private async cleanupStorageData(): Promise<{ deletedCases: number; errors: string[] }> {
    const result = { deletedCases: 0, errors: [] };
    
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const caseKeys = allKeys.filter(key => 
        key.startsWith('case_') || 
        key.startsWith('draft_') ||
        key.startsWith('verification_')
      );

      for (const key of caseKeys) {
        try {
          const data = await AsyncStorage.getItem(key);
          if (data) {
            const parsedData = JSON.parse(data);
            const timestamp = parsedData.timestamp || parsedData.lastModified || parsedData.createdAt;
            
            if (timestamp && this.isDataExpired(timestamp)) {
              if (!this.config.dryRun) {
                await AsyncStorage.removeItem(key);
              }
              result.deletedCases++;
              console.log(`🗑️ Deleted expired case data: ${key}`);
            }
          }
        } catch (error) {
          result.errors.push(`Failed to process key ${key}: ${error.message}`);
        }
      }
    } catch (error) {
      result.errors.push(`Storage cleanup failed: ${error.message}`);
    }

    return result;
  }

  /**
   * Clean up cached files from filesystem
   */
  private async cleanupCachedFiles(): Promise<{ deletedFiles: number; deletedSize: number; errors: string[] }> {
    const result = { deletedFiles: 0, deletedSize: 0, errors: [] };

    try {
      // Clean up images directory
      const imagesResult = await this.cleanupDirectory('images');
      result.deletedFiles += imagesResult.deletedFiles;
      result.deletedSize += imagesResult.deletedSize;
      result.errors.push(...imagesResult.errors);

      // Clean up cache directory
      const cacheResult = await this.cleanupDirectory('cache');
      result.deletedFiles += cacheResult.deletedFiles;
      result.deletedSize += cacheResult.deletedSize;
      result.errors.push(...cacheResult.errors);

      // Clean up temp directory
      const tempResult = await this.cleanupDirectory('temp');
      result.deletedFiles += tempResult.deletedFiles;
      result.deletedSize += tempResult.deletedSize;
      result.errors.push(...tempResult.errors);

    } catch (error) {
      result.errors.push(`File cleanup failed: ${error.message}`);
    }

    return result;
  }

  /**
   * Clean up a specific directory
   */
  private async cleanupDirectory(dirName: string): Promise<{ deletedFiles: number; deletedSize: number; errors: string[] }> {
    const result = { deletedFiles: 0, deletedSize: 0, errors: [] };

    try {
      const dirContents = await Filesystem.readdir({
        path: dirName,
        directory: Directory.Data
      });

      for (const file of dirContents.files) {
        try {
          const stat = await Filesystem.stat({
            path: `${dirName}/${file.name}`,
            directory: Directory.Data
          });

          if (this.isDataExpired(stat.mtime)) {
            if (!this.config.dryRun) {
              await Filesystem.deleteFile({
                path: `${dirName}/${file.name}`,
                directory: Directory.Data
              });
            }
            result.deletedFiles++;
            result.deletedSize += stat.size;
            console.log(`🗑️ Deleted expired file: ${dirName}/${file.name}`);
          }
        } catch (error) {
          result.errors.push(`Failed to process file ${file.name}: ${error.message}`);
        }
      }
    } catch (error) {
      // Directory might not exist, which is fine
      if (!error.message.includes('does not exist')) {
        result.errors.push(`Directory cleanup failed for ${dirName}: ${error.message}`);
      }
    }

    return result;
  }

  /**
   * Clean up auto-save data
   */
  private async cleanupAutoSaveData(): Promise<{ deletedCases: number; errors: string[] }> {
    const result = { deletedCases: 0, errors: [] };

    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const autoSaveKeys = allKeys.filter(key => key.startsWith('autosave_'));

      for (const key of autoSaveKeys) {
        try {
          const data = await AsyncStorage.getItem(key);
          if (data) {
            const parsedData = JSON.parse(data);
            const timestamp = parsedData.lastSaved || parsedData.timestamp;
            
            if (timestamp && this.isDataExpired(timestamp)) {
              if (!this.config.dryRun) {
                await AsyncStorage.removeItem(key);
              }
              result.deletedCases++;
              console.log(`🗑️ Deleted expired auto-save data: ${key}`);
            }
          }
        } catch (error) {
          result.errors.push(`Failed to process auto-save key ${key}: ${error.message}`);
        }
      }
    } catch (error) {
      result.errors.push(`Auto-save cleanup failed: ${error.message}`);
    }

    return result;
  }

  /**
   * Clean up temporary data
   */
  private async cleanupTemporaryData(): Promise<{ deletedFiles: number; deletedSize: number; errors: string[] }> {
    const result = { deletedFiles: 0, deletedSize: 0, errors: [] };

    try {
      // Clean up any temporary preferences
      const allKeys = await AsyncStorage.getAllKeys();
      const tempKeys = allKeys.filter(key => 
        key.startsWith('temp_') || 
        key.startsWith('cache_') ||
        key.includes('_temp_')
      );

      for (const key of tempKeys) {
        try {
          const data = await AsyncStorage.getItem(key);
          if (data) {
            const parsedData = JSON.parse(data);
            const timestamp = parsedData.timestamp || parsedData.created;
            
            if (timestamp && this.isDataExpired(timestamp)) {
              if (!this.config.dryRun) {
                await AsyncStorage.removeItem(key);
              }
              result.deletedFiles++;
              console.log(`🗑️ Deleted expired temp data: ${key}`);
            }
          }
        } catch (error) {
          result.errors.push(`Failed to process temp key ${key}: ${error.message}`);
        }
      }
    } catch (error) {
      result.errors.push(`Temporary data cleanup failed: ${error.message}`);
    }

    return result;
  }

  /**
   * Check if data is expired (older than retention period)
   */
  private isDataExpired(timestamp: string | number): boolean {
    const dataDate = new Date(timestamp);
    const now = new Date();
    const diffInDays = (now.getTime() - dataDate.getTime()) / (1000 * 60 * 60 * 24);
    return diffInDays > this.config.retentionDays;
  }

  /**
   * Schedule daily cleanup checks
   */
  private async scheduleCleanupCheck(): Promise<void> {
    try {
      // Schedule local notification for daily cleanup
      await LocalNotifications.schedule({
        notifications: [{
          title: 'CaseFlow Data Cleanup',
          body: 'Checking for old data to clean up...',
          id: 999,
          schedule: {
            repeats: true,
            every: 'day',
            at: new Date(new Date().setHours(2, 0, 0, 0)) // Run at 2 AM daily
          },
          sound: undefined,
          attachments: undefined,
          actionTypeId: '',
          extra: {
            action: 'cleanup_check'
          }
        }]
      });
    } catch (error) {
      console.warn('Failed to schedule cleanup notifications:', error);
    }
  }

  /**
   * Get last cleanup timestamp
   */
  private async getLastCleanupTimestamp(): Promise<number> {
    try {
      const { value } = await Preferences.get({ key: this.STORAGE_KEYS.LAST_CLEANUP });
      return value ? parseInt(value) : 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Update last cleanup timestamp
   */
  private async updateLastCleanupTimestamp(): Promise<void> {
    await Preferences.set({
      key: this.STORAGE_KEYS.LAST_CLEANUP,
      value: Date.now().toString()
    });
  }

  /**
   * Get user notification status
   */
  private async getUserNotificationStatus(): Promise<boolean> {
    try {
      const { value } = await Preferences.get({ key: this.STORAGE_KEYS.USER_NOTIFIED });
      return value === 'true';
    } catch (error) {
      return false;
    }
  }

  /**
   * Notify user about cleanup system
   */
  private async notifyUserAboutCleanup(): Promise<void> {
    try {
      await LocalNotifications.schedule({
        notifications: [{
          title: 'CaseFlow Data Management',
          body: `Automatic cleanup enabled. Case data older than ${this.RETENTION_DAYS} days will be automatically deleted to keep your app running smoothly.`,
          id: 998,
          schedule: {
            at: new Date(Date.now() + 5000) // Show in 5 seconds
          },
          sound: undefined,
          attachments: undefined,
          actionTypeId: '',
          extra: {}
        }]
      });

      await Preferences.set({
        key: this.STORAGE_KEYS.USER_NOTIFIED,
        value: 'true'
      });
    } catch (error) {
      console.warn('Failed to send user notification:', error);
    }
  }

  /**
   * Send cleanup completion notification
   */
  private async sendCleanupNotification(result: CleanupResult): Promise<void> {
    if (!this.config.enableNotifications) return;

    try {
      const message = `Cleaned up ${result.deletedCases} old cases and ${result.deletedFiles} files (${this.formatBytes(result.deletedSize)} freed)`;
      
      await LocalNotifications.schedule({
        notifications: [{
          title: 'CaseFlow Cleanup Complete',
          body: message,
          id: 997,
          schedule: {
            at: new Date(Date.now() + 1000)
          },
          sound: undefined,
          attachments: undefined,
          actionTypeId: '',
          extra: {}
        }]
      });
    } catch (error) {
      console.warn('Failed to send cleanup notification:', error);
    }
  }

  /**
   * Log cleanup result
   */
  private async logCleanupResult(result: CleanupResult): Promise<void> {
    if (!this.config.enableLogging) return;

    try {
      const logs = await this.getCleanupLogs();
      logs.push(result);
      
      // Keep only last 30 cleanup logs
      const recentLogs = logs.slice(-30);
      
      await Preferences.set({
        key: this.STORAGE_KEYS.CLEANUP_LOGS,
        value: JSON.stringify(recentLogs)
      });
    } catch (error) {
      console.warn('Failed to log cleanup result:', error);
    }
  }

  /**
   * Get cleanup logs
   */
  async getCleanupLogs(): Promise<CleanupResult[]> {
    try {
      const { value } = await Preferences.get({ key: this.STORAGE_KEYS.CLEANUP_LOGS });
      return value ? JSON.parse(value) : [];
    } catch (error) {
      return [];
    }
  }

  /**
   * Format bytes to human readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Manual cleanup trigger (for testing or user-initiated cleanup)
   */
  async manualCleanup(): Promise<CleanupResult> {
    console.log('🧹 Manual cleanup triggered');
    return await this.performCleanup();
  }

  /**
   * Get cleanup statistics
   */
  async getCleanupStats(): Promise<{
    lastCleanup: string;
    totalCleanupsRun: number;
    totalCasesDeleted: number;
    totalFilesDeleted: number;
    totalSpaceFreed: number;
  }> {
    const logs = await this.getCleanupLogs();
    const lastCleanup = await this.getLastCleanupTimestamp();
    
    return {
      lastCleanup: lastCleanup ? new Date(lastCleanup).toISOString() : 'Never',
      totalCleanupsRun: logs.length,
      totalCasesDeleted: logs.reduce((sum, log) => sum + log.deletedCases, 0),
      totalFilesDeleted: logs.reduce((sum, log) => sum + log.deletedFiles, 0),
      totalSpaceFreed: logs.reduce((sum, log) => sum + log.deletedSize, 0)
    };
  }

  /**
   * Update cleanup configuration
   */
  updateConfig(newConfig: Partial<CleanupConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Enable/disable cleanup system
   */
  async setCleanupEnabled(enabled: boolean): Promise<void> {
    await Preferences.set({
      key: this.STORAGE_KEYS.CLEANUP_ENABLED,
      value: enabled.toString()
    });
  }

  /**
   * Check if cleanup is enabled
   */
  async isCleanupEnabled(): Promise<boolean> {
    try {
      const { value } = await Preferences.get({ key: this.STORAGE_KEYS.CLEANUP_ENABLED });
      return value !== 'false'; // Default to enabled
    } catch (error) {
      return true;
    }
  }
}

// Export singleton instance
export const dataCleanupService = DataCleanupService.getInstance();
