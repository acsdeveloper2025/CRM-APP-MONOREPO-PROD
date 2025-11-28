import { VerificationTask, TaskStatus } from '../types';
import { taskService } from './taskService';
import AuthStorageService from './authStorageService';
import { getEnvironmentConfig } from '../config/environment';

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
   * Update case status with direct backend sync
   */
  /**
   * Update case status with direct backend sync
   */
  static async updateTaskStatus(
    taskId: string,
    newStatus: TaskStatus,
    options?: { optimistic?: boolean; auditMetadata?: any }
  ): Promise<StatusUpdateResult> {
    try {
      console.log(`🔄 Updating case ${taskId} status to ${newStatus}...`);

      // Get current case
      const task = await taskService.getTask(taskId);
      if (!task) {
        return { success: false, error: 'Case not found' };
      }

      // Validate status transition
      if (!this.isValidStatusTransition(task.status, newStatus)) {
        return {
          success: false,
          error: `Invalid status transition from ${task.status} to ${newStatus}`
        };
      }

      // Update local state
      await taskService.updateTask(taskId, { status: newStatus });
      console.log(`✅ Local update: VerificationTask ${taskId} status updated to ${newStatus}`);

      // Try to sync with backend, but don't fail if it's not available
      try {
        const syncResult = await this.syncStatusWithBackend(taskId, newStatus, {});
        if (syncResult.success) {
          console.log(`🌐 Backend sync successful for case ${taskId}`);
        } else {
          console.log(`⚠️ Backend sync failed (offline mode): ${syncResult.error}`);
        }
      } catch (error) {
        console.log(`📱 Working offline - backend sync will retry later`);
      }

      // Always return success for local update
      const updatedCase = await taskService.getTask(taskId);
      return {
        success: true,
        case: updatedCase,
      };
    } catch (error) {
      console.error(`❌ Failed to update case ${taskId} status:`, error);
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
      const productionUrl = 'https://example.com/api';
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
      console.log('🔍 Case Status Update - URL:', `${API_BASE_URL}/mobile/cases/${taskId}/status`);
      console.log('🔍 Case Status Update - Environment config:', envConfig);

      // Add cache-busting parameter
      const url = `${API_BASE_URL}/mobile/cases/${taskId}/status?t=${Date.now()}`;
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
