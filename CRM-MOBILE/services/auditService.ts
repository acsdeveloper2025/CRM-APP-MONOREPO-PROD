import { CaseStatus } from '../types';
import AuthStorageService from './authStorageService';
import NetworkService from './networkService';
import { apiService } from './apiService';

/**
 * Audit Service
 * Logs case status changes and other important actions for audit purposes
 */

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  username: string;
  action: string;
  entityType: 'case' | 'user' | 'system';
  entityId: string;
  details: {
    fromStatus?: CaseStatus;
    toStatus?: CaseStatus;
    caseId?: string;
    customerName?: string;
    verificationType?: string;
    metadata?: Record<string, any>;
  };
  deviceInfo: {
    userAgent: string;
    platform: string;
    isOnline: boolean;
    timestamp: string;
  };
  location?: {
    latitude?: number;
    longitude?: number;
    accuracy?: number;
    timestamp?: string;
  };
}

export interface AuditSyncResult {
  synced: number;
  failed: number;
  errors: string[];
}

class AuditService {
  private static readonly AUDIT_LOGS_KEY = 'caseflow_audit_logs';
  private static readonly MAX_LOCAL_LOGS = 1000; // Keep last 1000 logs locally
  private static readonly SYNC_BATCH_SIZE = 50; // Sync in batches of 50

  /**
   * Log a case status change
   */
  static async logCaseStatusChange(
    caseId: string,
    fromStatus: CaseStatus,
    toStatus: CaseStatus,
    caseDetails: {
      customerName?: string;
      verificationType?: string;
      metadata?: Record<string, any>;
    } = {}
  ): Promise<void> {
    try {
      const authData = await AuthStorageService.getAuthData();
      if (!authData) {
        console.warn('No auth data available for audit logging');
        return;
      }

      // Check for duplicate logs to prevent multiple entries for the same status change
      const existingLogs = await this.getLocalAuditLogs();
      const recentDuplicate = existingLogs.find(log =>
        log.action === 'case_status_change' &&
        log.entityId === caseId &&
        log.details.fromStatus === fromStatus &&
        log.details.toStatus === toStatus &&
        // Check if logged within the last 5 minutes to prevent duplicates
        (Date.now() - new Date(log.timestamp).getTime()) < 5 * 60 * 1000
      );

      if (recentDuplicate) {
        console.log(`⚠️ Skipping duplicate audit log for case ${caseId} status change: ${fromStatus} → ${toStatus}`);
        return;
      }

      const logEntry: AuditLogEntry = {
        id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        userId: authData.user.id,
        username: authData.user.username,
        action: 'case_status_change',
        entityType: 'case',
        entityId: caseId,
        details: {
          fromStatus,
          toStatus,
          caseId,
          customerName: caseDetails.customerName,
          verificationType: caseDetails.verificationType,
          metadata: caseDetails.metadata,
        },
        deviceInfo: {
          userAgent: navigator.userAgent,
          platform: this.getPlatform(),
          isOnline: NetworkService.isOnline(),
          timestamp: new Date().toISOString(),
        },
      };

      // Try to get location if available
      try {
        const location = await this.getCurrentLocation();
        if (location) {
          logEntry.location = location;
        }
      } catch (error) {
        // Location not available, continue without it
        console.log('Location not available for audit log');
      }

      await this.storeAuditLog(logEntry);
      console.log(`📝 Audit log created for case ${caseId} status change: ${fromStatus} → ${toStatus}`);

      // Attempt immediate sync if online
      if (NetworkService.isOnline()) {
        this.syncAuditLogs().catch(error => {
          console.log('Background audit sync failed:', error);
        });
      }
    } catch (error) {
      console.error('Failed to log case status change:', error);
    }
  }

  /**
   * Log a general action
   */
  static async logAction(
    action: string,
    entityType: 'case' | 'user' | 'system',
    entityId: string,
    details: Record<string, any> = {}
  ): Promise<void> {
    try {
      const authData = await AuthStorageService.getAuthData();
      if (!authData) {
        console.warn('No auth data available for audit logging');
        return;
      }

      const logEntry: AuditLogEntry = {
        id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        userId: authData.user.id,
        username: authData.user.username,
        action,
        entityType,
        entityId,
        details,
        deviceInfo: {
          userAgent: navigator.userAgent,
          platform: this.getPlatform(),
          isOnline: NetworkService.isOnline(),
          timestamp: new Date().toISOString(),
        },
      };

      await this.storeAuditLog(logEntry);
      console.log(`📝 Audit log created: ${action} on ${entityType} ${entityId}`);
    } catch (error) {
      console.error('Failed to log action:', error);
    }
  }

  /**
   * Store audit log locally
   */
  private static async storeAuditLog(logEntry: AuditLogEntry): Promise<void> {
    try {
      const existingLogs = await this.getLocalAuditLogs();
      
      // Add new log
      existingLogs.push(logEntry);
      
      // Keep only the most recent logs
      if (existingLogs.length > this.MAX_LOCAL_LOGS) {
        existingLogs.splice(0, existingLogs.length - this.MAX_LOCAL_LOGS);
      }

      localStorage.setItem(this.AUDIT_LOGS_KEY, JSON.stringify(existingLogs));
    } catch (error) {
      console.error('Failed to store audit log:', error);
    }
  }

  /**
   * Get local audit logs
   */
  static async getLocalAuditLogs(): Promise<AuditLogEntry[]> {
    try {
      const stored = localStorage.getItem(this.AUDIT_LOGS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to get local audit logs:', error);
      return [];
    }
  }

  /**
   * Sync audit logs with backend
   */
  static async syncAuditLogs(): Promise<AuditSyncResult> {
    try {
      const localLogs = await this.getLocalAuditLogs();
      const unsynced = localLogs.filter(log => !log.details.synced);

      if (unsynced.length === 0) {
        return { synced: 0, failed: 0, errors: [] };
      }

      console.log(`🔄 Syncing ${unsynced.length} audit logs...`);

      let synced = 0;
      let failed = 0;
      const errors: string[] = [];

      // Process in batches
      for (let i = 0; i < unsynced.length; i += this.SYNC_BATCH_SIZE) {
        const batch = unsynced.slice(i, i + this.SYNC_BATCH_SIZE);
        
        try {
          const result = await this.syncLogBatch(batch);
          
          if (result.success) {
            // Mark logs as synced
            batch.forEach(log => {
              log.details.synced = true;
              log.details.syncedAt = new Date().toISOString();
            });
            synced += batch.length;
          } else {
            failed += batch.length;
            errors.push(`Batch ${Math.floor(i / this.SYNC_BATCH_SIZE) + 1}: ${result.error}`);
          }
        } catch (error) {
          failed += batch.length;
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          errors.push(`Batch ${Math.floor(i / this.SYNC_BATCH_SIZE) + 1}: ${errorMsg}`);
        }
      }

      // Save updated logs
      await this.saveLocalAuditLogs(localLogs);

      console.log(`📊 Audit sync complete: ${synced} synced, ${failed} failed`);
      return { synced, failed, errors };
    } catch (error) {
      console.error('Failed to sync audit logs:', error);
      return { synced: 0, failed: 0, errors: [error instanceof Error ? error.message : 'Unknown error'] };
    }
  }

  /**
   * Sync a batch of logs with backend
   */
  private static async syncLogBatch(logs: AuditLogEntry[]): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await apiService.request('/mobile/audit/logs', {
        method: 'POST',
        requireAuth: true,
        body: {
          logs,
          batchId: `batch_${Date.now()}`,
          deviceId: 'web-mobile-app',
        },
      });

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error'
      };
    }
  }

  /**
   * Save local audit logs
   */
  private static async saveLocalAuditLogs(logs: AuditLogEntry[]): Promise<void> {
    try {
      localStorage.setItem(this.AUDIT_LOGS_KEY, JSON.stringify(logs));
    } catch (error) {
      console.error('Failed to save local audit logs:', error);
    }
  }

  /**
   * Get current location for audit logging
   */
  private static getCurrentLocation(): Promise<{
    latitude: number;
    longitude: number;
    accuracy: number;
    timestamp: string;
  } | null> {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }

      const timeoutId = setTimeout(() => {
        resolve(null);
      }, 5000); // 5 second timeout

      navigator.geolocation.getCurrentPosition(
        (position) => {
          clearTimeout(timeoutId);
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: new Date().toISOString(),
          });
        },
        () => {
          clearTimeout(timeoutId);
          resolve(null);
        },
        {
          enableHighAccuracy: false,
          timeout: 5000,
          maximumAge: 300000, // 5 minutes
        }
      );
    });
  }

  /**
   * Get platform information
   */
  private static getPlatform(): string {
    const userAgent = navigator.userAgent.toLowerCase();
    
    if (userAgent.includes('mobile')) return 'mobile';
    if (userAgent.includes('tablet')) return 'tablet';
    if (userAgent.includes('android')) return 'android';
    if (userAgent.includes('iphone') || userAgent.includes('ipad')) return 'ios';
    if (userAgent.includes('windows')) return 'windows';
    if (userAgent.includes('mac')) return 'mac';
    if (userAgent.includes('linux')) return 'linux';
    
    return 'web';
  }

  /**
   * Get unsynced audit logs count
   */
  static async getUnsyncedLogsCount(): Promise<number> {
    try {
      const logs = await this.getLocalAuditLogs();
      return logs.filter(log => !log.details.synced).length;
    } catch (error) {
      console.error('Failed to get unsynced logs count:', error);
      return 0;
    }
  }

  /**
   * Clean up duplicate audit logs
   */
  static async cleanupDuplicateAuditLogs(): Promise<{
    removed: number;
    remaining: number;
  }> {
    try {
      const logs = await this.getLocalAuditLogs();
      const uniqueLogs: AuditLogEntry[] = [];
      const seen = new Set<string>();
      let removedCount = 0;

      // Create unique key for each log to identify duplicates
      for (const log of logs) {
        const uniqueKey = `${log.action}_${log.entityId}_${log.details.fromStatus}_${log.details.toStatus}_${log.userId}`;

        if (!seen.has(uniqueKey)) {
          seen.add(uniqueKey);
          uniqueLogs.push(log);
        } else {
          removedCount++;
          console.log(`🗑️ Removing duplicate audit log: ${log.action} for ${log.entityId}`);
        }
      }

      // Save cleaned logs
      await this.saveLocalAuditLogs(uniqueLogs);

      console.log(`🧹 Cleaned up ${removedCount} duplicate audit logs, ${uniqueLogs.length} remaining`);

      return {
        removed: removedCount,
        remaining: uniqueLogs.length,
      };
    } catch (error) {
      console.error('Failed to cleanup duplicate audit logs:', error);
      return { removed: 0, remaining: 0 };
    }
  }

  /**
   * Clear all local audit logs (for testing or reset)
   */
  static async clearLocalAuditLogs(): Promise<void> {
    try {
      localStorage.removeItem(this.AUDIT_LOGS_KEY);
      console.log('🗑️ Cleared all local audit logs');
    } catch (error) {
      console.error('Failed to clear local audit logs:', error);
    }
  }

  /**
   * Get audit logs for a specific case
   */
  static async getCaseAuditLogs(caseId: string): Promise<AuditLogEntry[]> {
    try {
      const logs = await this.getLocalAuditLogs();
      return logs.filter(log => 
        log.entityType === 'case' && 
        (log.entityId === caseId || log.details.caseId === caseId)
      );
    } catch (error) {
      console.error('Failed to get case audit logs:', error);
      return [];
    }
  }
}

export default AuditService;
