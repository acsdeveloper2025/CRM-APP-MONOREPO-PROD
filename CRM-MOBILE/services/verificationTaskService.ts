import AuthStorageService from './authStorageService';

/**
 * Service for managing verification tasks in the mobile app
 * Handles task-level operations (start, complete, update status)
 */
export class VerificationTaskService {
  /**
   * Get the API base URL - Environment-aware configuration
   */
  private static getApiBaseUrl(): string {
    // Check if we're in production mode
    const isProduction = import.meta.env.PROD;

    if (isProduction) {
      // Production: Use domain-based API URL
      return 'https://crm.allcheckservices.com/api';
    } else {
      // Development: Try static IP first, then fallback to localhost
      if (import.meta.env.VITE_API_BASE_URL_STATIC_IP) {
        return import.meta.env.VITE_API_BASE_URL_STATIC_IP;
      }

      // Fallback to localhost for development
      return import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';
    }
  }

  /**
   * Get common headers for API requests
   */
  private static async getHeaders(): Promise<HeadersInit> {
    const authToken = await AuthStorageService.getCurrentAccessToken();

    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
      'X-App-Version': '4.0.1',
      'X-Platform': 'WEB',
      'X-Client-Type': 'mobile',
    };
  }

  /**
   * Start working on a verification task
   * Changes status from ASSIGNED → IN_PROGRESS
   * 
   * @param taskId - Verification task UUID
   * @returns Promise with success status and updated task data
   */
  static async startTask(taskId: string): Promise<{
    success: boolean;
    data?: any;
    error?: string;
  }> {
    try {
      const API_BASE_URL = this.getApiBaseUrl();
      const headers = await this.getHeaders();

      console.log(`🎯 Starting verification task ${taskId}...`);

      const response = await fetch(`${API_BASE_URL}/mobile/verification-tasks/${taskId}/start`, {
        method: 'POST',
        headers,
      });

      const result = await response.json();

      if (response.ok && result.success) {
        console.log(`✅ Task ${taskId} started successfully`);
        return {
          success: true,
          data: result.data,
        };
      } else {
        console.error(`❌ Failed to start task: ${result.message}`);
        return {
          success: false,
          error: result.message || 'Failed to start task',
        };
      }
    } catch (error) {
      console.error('❌ Error starting task:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  }

  /**
   * Update verification task status
   * 
   * @param taskId - Verification task UUID
   * @param status - New status (PENDING, ASSIGNED, IN_PROGRESS, COMPLETED, CANCELLED, ON_HOLD)
   * @returns Promise with success status and updated task data
   */
  static async updateTaskStatus(
    taskId: string,
    status: 'PENDING' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'ON_HOLD'
  ): Promise<{
    success: boolean;
    data?: any;
    error?: string;
  }> {
    try {
      const API_BASE_URL = this.getApiBaseUrl();
      const headers = await this.getHeaders();

      console.log(`🔄 Updating task ${taskId} status to ${status}...`);

      const response = await fetch(`${API_BASE_URL}/mobile/verification-tasks/${taskId}/status`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ status }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        console.log(`✅ Task ${taskId} status updated to ${status}`);
        return {
          success: true,
          data: result.data,
        };
      } else {
        console.error(`❌ Failed to update task status: ${result.message}`);
        return {
          success: false,
          error: result.message || 'Failed to update task status',
        };
      }
    } catch (error) {
      console.error('❌ Error updating task status:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  }

  /**
   * Complete a verification task
   * Changes status to COMPLETED and sets verification outcome
   * 
   * @param taskId - Verification task UUID
   * @param verificationOutcome - Outcome of the verification
   * @param actualAmount - Optional actual amount (defaults to estimated amount)
   * @returns Promise with success status and completed task data
   */
  static async completeTask(
    taskId: string,
    verificationOutcome: string,
    actualAmount?: number
  ): Promise<{
    success: boolean;
    data?: any;
    error?: string;
  }> {
    try {
      const API_BASE_URL = this.getApiBaseUrl();
      const headers = await this.getHeaders();

      console.log(`✅ Completing verification task ${taskId}...`);

      const response = await fetch(`${API_BASE_URL}/mobile/verification-tasks/${taskId}/complete`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          verificationOutcome,
          actualAmount,
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        console.log(`✅ Task ${taskId} completed successfully`);
        return {
          success: true,
          data: result.data,
        };
      } else {
        console.error(`❌ Failed to complete task: ${result.message}`);
        return {
          success: false,
          error: result.message || 'Failed to complete task',
        };
      }
    } catch (error) {
      console.error('❌ Error completing task:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  }

  /**
   * Cancel a verification task
   * Changes status to CANCELLED
   * 
   * @param taskId - Verification task UUID
   * @param reason - Reason for cancellation
   * @returns Promise with success status
   */
  static async cancelTask(
    taskId: string,
    reason?: string
  ): Promise<{
    success: boolean;
    data?: any;
    error?: string;
  }> {
    try {
      const result = await this.updateTaskStatus(taskId, 'CANCELLED');
      
      if (result.success) {
        console.log(`✅ Task ${taskId} cancelled${reason ? `: ${reason}` : ''}`);
      }
      
      return result;
    } catch (error) {
      console.error('❌ Error cancelling task:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  }

  /**
   * Put a verification task on hold
   * Changes status to ON_HOLD
   * 
   * @param taskId - Verification task UUID
   * @param reason - Reason for putting on hold
   * @returns Promise with success status
   */
  static async holdTask(
    taskId: string,
    reason?: string
  ): Promise<{
    success: boolean;
    data?: any;
    error?: string;
  }> {
    try {
      const result = await this.updateTaskStatus(taskId, 'ON_HOLD');
      
      if (result.success) {
        console.log(`⏸️ Task ${taskId} put on hold${reason ? `: ${reason}` : ''}`);
      }
      
      return result;
    } catch (error) {
      console.error('❌ Error putting task on hold:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  }

  /**
   * Revoke a verification task
   * Field agent can revoke a task they cannot complete
   *
   * @param taskId - Verification task UUID
   * @param reason - Reason for revoking the task
   * @returns Promise with success status and revocation data
   */
  static async revokeTask(
    taskId: string,
    reason: string
  ): Promise<{
    success: boolean;
    data?: any;
    error?: string;
  }> {
    try {
      const apiBaseUrl = this.getApiBaseUrl();
      const headers = await this.getHeaders();

      console.log(`🚫 Revoking task ${taskId}...`);

      const response = await fetch(
        `${apiBaseUrl}/mobile/verification-tasks/${taskId}/revoke`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ reason }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        console.error('❌ Task revocation failed:', result);
        return {
          success: false,
          error: result.message || 'Failed to revoke task',
        };
      }

      if (result.success) {
        console.log(`✅ Task ${taskId} revoked successfully`);
      }

      return result;
    } catch (error) {
      console.error('❌ Error revoking task:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  }
}

