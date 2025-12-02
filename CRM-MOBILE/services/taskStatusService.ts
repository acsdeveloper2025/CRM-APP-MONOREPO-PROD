import { VerificationTask, TaskStatus } from '../types';
import { taskService } from './taskService';
import AuthStorageService from './authStorageService';
import { getEnvironmentConfig } from '../config/environment';
import EnterpriseOfflineDatabase from '../src/services/EnterpriseOfflineDatabase';
import EnterpriseSyncService from '../src/services/EnterpriseSyncService';
import NetworkService from './networkService';

/**
 * Simple Case Status Service
 * Handles case status updates with direct backend sync
 */

export interface StatusUpdateResult {
  success: boolean;
  case?: VerificationTask;
  error?: string;
}

class TaskStatusService {

  /**
   * Update task status with offline-first approach
   * - Saves to local DB immediately (works offline)
   * - Syncs to backend if online
   * - Adds to sync queue if offline or sync fails
   */
  static async updateTaskStatus(
    taskId: string,
    newStatus: TaskStatus,
    options?: { optimistic?: boolean; auditMetadata?: any }
  ): Promise<StatusUpdateResult> {
    try {
      console.log(`🔄 Updating task ${taskId} status to ${newStatus}...`);

      // Get current task
      const task = await taskService.getTask(taskId);
      if (!task) {
        return { success: false, error: 'Task not found' };
      }

      // Validate status transition
      if (!this.isValidStatusTransition(task.status, newStatus)) {
        return {
          success: false,
          error: `Invalid status transition from ${task.status} to ${newStatus}`
        };
      }

      // Check network connectivity
      const isOnline = NetworkService.isOnline();
      console.log(`📡 Network status: ${isOnline ? 'Online' : 'Offline'}`);

      // STEP 1: Always save to local database first (offline-first)
      try {
        await EnterpriseOfflineDatabase.updateTaskStatus(taskId, this.mapMobileStatusToBackend(newStatus));
        console.log(`💾 Local DB: Task ${taskId} status saved to offline database`);
      } catch (dbError) {
        console.error(`❌ Failed to save to local DB:`, dbError);
        // Continue anyway - we'll try the API
      }

      // STEP 2: Update in-memory state
      await taskService.updateTask(taskId, { status: newStatus });
      console.log(`✅ Memory: Task ${taskId} status updated to ${newStatus}`);

      // STEP 3: Try to sync with backend if online
      if (isOnline) {
        try {
          const syncResult = await this.syncStatusWithBackend(taskId, newStatus, options?.auditMetadata || {});
          if (syncResult.success) {
            console.log(`🌐 Backend sync successful for task ${taskId}`);
            // Sync succeeded - no need to queue
            const updatedTask = await taskService.getTask(taskId);
            return { success: true, case: updatedTask };
          } else {
            console.warn(`⚠️ Backend sync failed: ${syncResult.error}`);
            // Fall through to add to sync queue
          }
        } catch (syncError) {
          console.warn(`⚠️ Backend sync error:`, syncError);
          // Fall through to add to sync queue
        }
      }

      // STEP 4: Add to sync queue (if offline OR sync failed)
      try {
        await EnterpriseSyncService.addToSyncQueue({
          actionType: 'update_status',
          entityType: 'task',
          entityId: taskId,
          actionData: JSON.stringify({
            status: newStatus,
            backendStatus: this.mapMobileStatusToBackend(newStatus),
            metadata: options?.auditMetadata || {},
            timestamp: new Date().toISOString()
          }),
          priority: 1
        });
        console.log(`📋 Added to sync queue: Task ${taskId} status change will sync when online`);
      } catch (queueError) {
        console.error(`❌ Failed to add to sync queue:`, queueError);
      }

      // Always return success for local update
      const updatedTask = await taskService.getTask(taskId);
      return {
        success: true,
        case: updatedTask,
      };
    } catch (error) {
      console.error(`❌ Failed to update task ${taskId} status:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Validate if status transition is allowed
   */
  private static isValidStatusTransition(from: TaskStatus, to: TaskStatus): boolean {
    const validTransitions: Record<TaskStatus, TaskStatus[]> = {
      [TaskStatus.Assigned]: [TaskStatus.InProgress],
      [TaskStatus.InProgress]: [TaskStatus.Completed, TaskStatus.Assigned], // Allow back to assigned for revoke
      [TaskStatus.Completed]: [], // Completed cases cannot change status
      [TaskStatus.Saved]: [TaskStatus.InProgress, TaskStatus.Completed], // Saved cases can resume
    };

    return validTransitions[from]?.includes(to) || false;
  }



  /**
   * Get API base URL - Environment-aware configuration
   */
  private static getApiBaseUrl(): string {
    console.log('🔍 Case Status Service - API Configuration');

    // Check if we're in production mode
    const isProduction = import.meta.env.PROD;

    if (isProduction) {
      // Production: Use domain-based API URL
      const productionUrl = 'https://crm.allcheckservices.com/api';
      console.log('🌍 Case Status Service - Using Production API URL:', productionUrl);
      return productionUrl;
    } else {
      // Development: Try static IP first, then fallback to localhost
      if (import.meta.env.VITE_API_BASE_URL_STATIC_IP) {
        const url = import.meta.env.VITE_API_BASE_URL_STATIC_IP;
        console.log('🌍 Case Status Service - Using Static IP API URL:', url);
        return url;
      }

      // Fallback to localhost for development
      const devUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';
      console.log('🌍 Case Status Service - Using Development API URL:', devUrl);
      return devUrl;
    }
  }

  /**
   * Sync status update with backend
   */
  private static async syncStatusWithBackend(
    taskId: string,
    status: TaskStatus,
    metadata: Record<string, any>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const API_BASE_URL = this.getApiBaseUrl();
      const authToken = await AuthStorageService.getCurrentAccessToken();

      if (!authToken) {
        return { success: false, error: 'No authentication token available' };
      }

      // Map mobile status to backend status
      const backendStatus = this.mapMobileStatusToBackend(status);

      const envConfig = getEnvironmentConfig();
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
        'X-App-Version': envConfig.app.version,
        'X-Platform': 'WEB',
        'X-Client-Type': 'mobile',
      };

      console.log('🔍 Case Status Update - Headers being sent:', headers);
      console.log('🔍 Case Status Update - URL:', `${API_BASE_URL}/mobile/verification-tasks/${taskId}/status`);
      console.log('🔍 Case Status Update - Environment config:', envConfig);

      // Add cache-busting parameter
      const url = `${API_BASE_URL}/mobile/verification-tasks/${taskId}/status?t=${Date.now()}`;
      console.log('🔍 Case Status Update - Final URL with cache-buster:', url);

      const response = await fetch(url, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          status: backendStatus,
          metadata: {
            ...metadata,
            updatedAt: new Date().toISOString(),
            source: 'mobile_app',
          },
        }),
      });

      console.log('🔍 Case Status Update - Response status:', response.status);
      console.log('🔍 Case Status Update - Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Case Status Update - Error response:', errorData);
        return {
          success: false,
          error: errorData.message || `HTTP ${response.status}: ${response.statusText}`
        };
      }

      const result = await response.json();
      return { success: result.success || true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Network error' 
      };
    }
  }

  /**
   * Map mobile status to backend status format
   */
  private static mapMobileStatusToBackend(status: TaskStatus): string {
    const statusMap: Record<TaskStatus, string> = {
      [TaskStatus.Assigned]: 'PENDING',
      [TaskStatus.InProgress]: 'IN_PROGRESS',
      [TaskStatus.Completed]: 'COMPLETED',
      [TaskStatus.Saved]: 'IN_PROGRESS', // Saved maps to In Progress on backend
    };

    return statusMap[status] || 'PENDING';
  }


}

export default TaskStatusService;
