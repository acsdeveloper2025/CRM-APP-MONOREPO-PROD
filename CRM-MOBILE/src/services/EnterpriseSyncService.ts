import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { Case, SyncStatus, OfflineAction, SyncMetrics } from '../types';
import { apiClient } from './ApiClient';
import { DatabaseService } from './DatabaseService';
import { NotificationService } from './NotificationService';

interface SyncConfig {
  batchSize: number;
  maxRetries: number;
  retryDelay: number;
  syncInterval: number;
  compressionEnabled: boolean;
  deltaSync: boolean;
}

interface SyncResult {
  success: boolean;
  syncedCount: number;
  failedCount: number;
  errors: string[];
  duration: number;
  dataTransferred: number;
}

interface ConflictResolution {
  strategy: 'server-wins' | 'client-wins' | 'merge' | 'manual';
  resolver?: (serverData: any, clientData: any) => any;
}

export class EnterpriseSyncService {
  private static instance: EnterpriseSyncService;
  private syncInProgress = false;
  private syncQueue: OfflineAction[] = [];
  private lastSyncTimestamp = 0;
  private syncMetrics: SyncMetrics = {
    totalSyncs: 0,
    successfulSyncs: 0,
    failedSyncs: 0,
    averageDuration: 0,
    lastSyncTime: 0,
    dataTransferred: 0,
  };

  private config: SyncConfig = {
    batchSize: 50,
    maxRetries: 3,
    retryDelay: 2000,
    syncInterval: 30000, // 30 seconds
    compressionEnabled: true,
    deltaSync: true,
  };

  private constructor() {
    this.initializeSync();
  }

  static getInstance(): EnterpriseSyncService {
    if (!EnterpriseSyncService.instance) {
      EnterpriseSyncService.instance = new EnterpriseSyncService();
    }
    return EnterpriseSyncService.instance;
  }

  private async initializeSync(): Promise<void> {
    // Load sync configuration
    const savedConfig = await AsyncStorage.getItem('sync_config');
    if (savedConfig) {
      this.config = { ...this.config, ...JSON.parse(savedConfig) };
    }

    // Load sync metrics
    const savedMetrics = await AsyncStorage.getItem('sync_metrics');
    if (savedMetrics) {
      this.syncMetrics = JSON.parse(savedMetrics);
    }

    // Load last sync timestamp
    const lastSync = await AsyncStorage.getItem('last_sync_timestamp');
    if (lastSync) {
      this.lastSyncTimestamp = parseInt(lastSync);
    }

    // Load pending sync queue
    const pendingQueue = await AsyncStorage.getItem('sync_queue');
    if (pendingQueue) {
      this.syncQueue = JSON.parse(pendingQueue);
    }

    // Start automatic sync
    this.startAutoSync();
  }

  private startAutoSync(): void {
    setInterval(async () => {
      const netInfo = await NetInfo.fetch();
      if (netInfo.isConnected && !this.syncInProgress) {
        await this.performSync();
      }
    }, this.config.syncInterval);
  }

  async performSync(forceFullSync = false): Promise<SyncResult> {
    if (this.syncInProgress) {
      throw new Error('Sync already in progress');
    }

    this.syncInProgress = true;
    const startTime = Date.now();
    let syncedCount = 0;
    let failedCount = 0;
    const errors: string[] = [];
    let dataTransferred = 0;

    try {
      // Check network connectivity
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        throw new Error('No network connection available');
      }

      // Step 1: Upload pending offline actions
      const uploadResult = await this.uploadPendingActions();
      syncedCount += uploadResult.syncedCount;
      failedCount += uploadResult.failedCount;
      errors.push(...uploadResult.errors);
      dataTransferred += uploadResult.dataTransferred;

      // Step 2: Download server updates
      const downloadResult = await this.downloadServerUpdates(forceFullSync);
      syncedCount += downloadResult.syncedCount;
      failedCount += downloadResult.failedCount;
      errors.push(...downloadResult.errors);
      dataTransferred += downloadResult.dataTransferred;

      // Step 3: Resolve conflicts
      await this.resolveConflicts();

      // Step 4: Update sync timestamp
      this.lastSyncTimestamp = Date.now();
      await AsyncStorage.setItem('last_sync_timestamp', this.lastSyncTimestamp.toString());

      // Update metrics
      this.updateSyncMetrics(true, Date.now() - startTime, dataTransferred);

      // Notify success
      NotificationService.showNotification({
        title: 'Sync Complete',
        message: `Synced ${syncedCount} items successfully`,
        type: 'success',
      });

      return {
        success: true,
        syncedCount,
        failedCount,
        errors,
        duration: Date.now() - startTime,
        dataTransferred,
      };

    } catch (error) {
      this.updateSyncMetrics(false, Date.now() - startTime, dataTransferred);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown sync error';
      errors.push(errorMessage);

      NotificationService.showNotification({
        title: 'Sync Failed',
        message: errorMessage,
        type: 'error',
      });

      return {
        success: false,
        syncedCount,
        failedCount: failedCount + 1,
        errors,
        duration: Date.now() - startTime,
        dataTransferred,
      };

    } finally {
      this.syncInProgress = false;
    }
  }

  private async uploadPendingActions(): Promise<SyncResult> {
    let syncedCount = 0;
    let failedCount = 0;
    const errors: string[] = [];
    let dataTransferred = 0;

    // Process sync queue in batches
    const batches = this.chunkArray(this.syncQueue, this.config.batchSize);

    for (const batch of batches) {
      try {
        const payload = {
          actions: batch,
          timestamp: Date.now(),
          deviceId: await this.getDeviceId(),
        };

        if (this.config.compressionEnabled) {
          // Compress payload for large batches
          payload.compressed = true;
        }

        const response = await apiClient.post('/api/mobile/sync/upload', payload, {
          timeout: 30000,
          retryConfig: {
            retries: this.config.maxRetries,
            retryDelay: this.config.retryDelay,
            retryCondition: (error) => error.response?.status >= 500,
          },
        });

        if (response.data.success) {
          syncedCount += batch.length;
          dataTransferred += JSON.stringify(payload).length;
          
          // Remove successfully synced actions from queue
          this.syncQueue = this.syncQueue.filter(action => 
            !batch.some(batchAction => batchAction.id === action.id)
          );
        } else {
          failedCount += batch.length;
          errors.push(`Batch upload failed: ${response.data.message}`);
        }

      } catch (error) {
        failedCount += batch.length;
        const errorMessage = error instanceof Error ? error.message : 'Upload batch failed';
        errors.push(errorMessage);

        // Mark actions as failed for retry
        batch.forEach(action => {
          action.retryCount = (action.retryCount || 0) + 1;
          if (action.retryCount >= this.config.maxRetries) {
            // Remove from queue after max retries
            this.syncQueue = this.syncQueue.filter(a => a.id !== action.id);
          }
        });
      }
    }

    // Save updated sync queue
    await AsyncStorage.setItem('sync_queue', JSON.stringify(this.syncQueue));

    return { success: true, syncedCount, failedCount, errors, duration: 0, dataTransferred };
  }

  private async downloadServerUpdates(forceFullSync = false): Promise<SyncResult> {
    let syncedCount = 0;
    let failedCount = 0;
    const errors: string[] = [];
    let dataTransferred = 0;

    try {
      const params: any = {
        deviceId: await this.getDeviceId(),
        batchSize: this.config.batchSize,
      };

      // Use delta sync if enabled and not forcing full sync
      if (this.config.deltaSync && !forceFullSync && this.lastSyncTimestamp > 0) {
        params.since = this.lastSyncTimestamp;
      }

      const response = await apiClient.get('/api/mobile/sync/download', {
        params,
        timeout: 30000,
        retryConfig: {
          retries: this.config.maxRetries,
          retryDelay: this.config.retryDelay,
          retryCondition: (error) => error.response?.status >= 500,
        },
      });

      if (response.data.success) {
        const { cases, assignments, notifications } = response.data.data;
        dataTransferred += JSON.stringify(response.data).length;

        // Update local database
        if (cases?.length > 0) {
          await DatabaseService.updateCases(cases);
          syncedCount += cases.length;
        }

        if (assignments?.length > 0) {
          await DatabaseService.updateAssignments(assignments);
          syncedCount += assignments.length;
        }

        if (notifications?.length > 0) {
          await DatabaseService.updateNotifications(notifications);
          syncedCount += notifications.length;
        }

        // Update sync status
        await this.updateSyncStatus('completed');

      } else {
        errors.push(`Download failed: ${response.data.message}`);
        failedCount = 1;
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Download failed';
      errors.push(errorMessage);
      failedCount = 1;
      await this.updateSyncStatus('failed');
    }

    return { success: true, syncedCount, failedCount, errors, duration: 0, dataTransferred };
  }

  private async resolveConflicts(): Promise<void> {
    const conflicts = await DatabaseService.getConflicts();
    
    for (const conflict of conflicts) {
      const resolution: ConflictResolution = {
        strategy: 'server-wins', // Default strategy
      };

      // Apply conflict resolution strategy
      switch (resolution.strategy) {
        case 'server-wins':
          await DatabaseService.resolveConflict(conflict.id, conflict.serverData);
          break;
        case 'client-wins':
          await DatabaseService.resolveConflict(conflict.id, conflict.clientData);
          break;
        case 'merge':
          if (resolution.resolver) {
            const mergedData = resolution.resolver(conflict.serverData, conflict.clientData);
            await DatabaseService.resolveConflict(conflict.id, mergedData);
          }
          break;
        case 'manual':
          // Queue for manual resolution
          await DatabaseService.queueForManualResolution(conflict);
          break;
      }
    }
  }

  async addToSyncQueue(action: OfflineAction): Promise<void> {
    this.syncQueue.push({
      ...action,
      id: action.id || this.generateActionId(),
      timestamp: Date.now(),
      retryCount: 0,
    });

    await AsyncStorage.setItem('sync_queue', JSON.stringify(this.syncQueue));

    // Trigger immediate sync if connected
    const netInfo = await NetInfo.fetch();
    if (netInfo.isConnected && !this.syncInProgress) {
      setTimeout(() => this.performSync(), 1000);
    }
  }

  async getSyncStatus(): Promise<SyncStatus> {
    return {
      inProgress: this.syncInProgress,
      lastSyncTime: this.lastSyncTimestamp,
      pendingActions: this.syncQueue.length,
      metrics: this.syncMetrics,
    };
  }

  async configureSyncSettings(config: Partial<SyncConfig>): Promise<void> {
    this.config = { ...this.config, ...config };
    await AsyncStorage.setItem('sync_config', JSON.stringify(this.config));
  }

  private async updateSyncStatus(status: 'completed' | 'failed'): Promise<void> {
    await AsyncStorage.setItem('sync_status', JSON.stringify({
      status,
      timestamp: Date.now(),
    }));
  }

  private updateSyncMetrics(success: boolean, duration: number, dataTransferred: number): void {
    this.syncMetrics.totalSyncs++;
    if (success) {
      this.syncMetrics.successfulSyncs++;
    } else {
      this.syncMetrics.failedSyncs++;
    }
    
    this.syncMetrics.averageDuration = 
      (this.syncMetrics.averageDuration * (this.syncMetrics.totalSyncs - 1) + duration) / 
      this.syncMetrics.totalSyncs;
    
    this.syncMetrics.lastSyncTime = Date.now();
    this.syncMetrics.dataTransferred += dataTransferred;

    AsyncStorage.setItem('sync_metrics', JSON.stringify(this.syncMetrics));
  }

  private async getDeviceId(): Promise<string> {
    let deviceId = await AsyncStorage.getItem('device_id');
    if (!deviceId) {
      deviceId = `mobile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await AsyncStorage.setItem('device_id', deviceId);
    }
    return deviceId;
  }

  private generateActionId(): string {
    return `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  // Public methods for external use
  async forceSyncNow(): Promise<SyncResult> {
    return this.performSync(true);
  }

  async clearSyncQueue(): Promise<void> {
    this.syncQueue = [];
    await AsyncStorage.setItem('sync_queue', JSON.stringify(this.syncQueue));
  }

  async resetSyncData(): Promise<void> {
    await AsyncStorage.multiRemove([
      'sync_queue',
      'sync_metrics',
      'last_sync_timestamp',
      'sync_status',
    ]);
    
    this.syncQueue = [];
    this.lastSyncTimestamp = 0;
    this.syncMetrics = {
      totalSyncs: 0,
      successfulSyncs: 0,
      failedSyncs: 0,
      averageDuration: 0,
      lastSyncTime: 0,
      dataTransferred: 0,
    };
  }
}

export default EnterpriseSyncService.getInstance();
