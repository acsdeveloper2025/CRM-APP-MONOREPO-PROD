import { Case, CaseStatus } from '../types';
import { caseService } from './caseService';
import AuthStorageService from './authStorageService';
import { getEnvironmentConfig } from '../config/environment';

/**
 * Simple Case Status Service
 * Handles case status updates with direct backend sync
 */

export interface StatusUpdateResult {
  success: boolean;
  case?: Case;
  error?: string;
}

class CaseStatusService {

  /**
   * Update case status with direct backend sync
   */
  static async updateCaseStatus(
    caseId: string,
    newStatus: CaseStatus,
    options?: { optimistic?: boolean; auditMetadata?: any }
  ): Promise<StatusUpdateResult> {
    try {
      console.log(`🔄 Updating case ${caseId} status to ${newStatus}...`);

      // Get current case
      const currentCase = await caseService.getCase(caseId);
      if (!currentCase) {
        return { success: false, error: 'Case not found' };
      }

      // Validate status transition
      if (!this.isValidStatusTransition(currentCase.status, newStatus)) {
        return {
          success: false,
          error: `Invalid status transition from ${currentCase.status} to ${newStatus}`
        };
      }

      // Update local state
      await caseService.updateCase(caseId, { status: newStatus });
      console.log(`✅ Local update: Case ${caseId} status updated to ${newStatus}`);

      // Try to sync with backend, but don't fail if it's not available
      try {
        const syncResult = await this.syncStatusWithBackend(caseId, newStatus, {});
        if (syncResult.success) {
          console.log(`🌐 Backend sync successful for case ${caseId}`);
        } else {
          console.log(`⚠️ Backend sync failed (offline mode): ${syncResult.error}`);
        }
      } catch (error) {
        console.log(`📱 Working offline - backend sync will retry later`);
      }

      // Always return success for local update
      const updatedCase = await caseService.getCase(caseId);
      return {
        success: true,
        case: updatedCase,
      };
    } catch (error) {
      console.error(`❌ Failed to update case ${caseId} status:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Validate if status transition is allowed
   */
  private static isValidStatusTransition(from: CaseStatus, to: CaseStatus): boolean {
    const validTransitions: Record<CaseStatus, CaseStatus[]> = {
      [CaseStatus.Assigned]: [CaseStatus.InProgress],
      [CaseStatus.InProgress]: [CaseStatus.Completed, CaseStatus.Assigned], // Allow back to assigned for revoke
      [CaseStatus.Completed]: [], // Completed cases cannot change status
    };

    return validTransitions[from]?.includes(to) || false;
  }



  /**
   * Get smart API base URL with fallback logic
   */
  private static getApiBaseUrl(): string {
    const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
    const isLocalNetwork = hostname.startsWith('10.') || hostname.startsWith('192.168.') || hostname.startsWith('172.');

    console.log('🌐 Case Status Service - API URL Detection:', {
      hostname,
      isLocalhost,
      isLocalNetwork,
      MODE: import.meta.env.MODE,
      VITE_API_BASE_URL_STATIC_IP: import.meta.env.VITE_API_BASE_URL_STATIC_IP,
      VITE_API_BASE_URL_DEVICE: import.meta.env.VITE_API_BASE_URL_DEVICE,
      VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL
    });

    if (isLocalhost) {
      const url = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';
      console.log('🏠 Case Status Service - Using localhost API URL:', url);
      return url;
    } else if (isLocalNetwork) {
      // Use local network IP to avoid hairpin NAT issues
      const url = import.meta.env.VITE_API_BASE_URL_DEVICE || 'http://103.14.234.36:3000/api';
      console.log('🏠 Case Status Service - Using local network API URL (hairpin NAT workaround):', url);
      return url;
    } else {
      // Use static IP for external access
      const url = import.meta.env.VITE_API_BASE_URL_STATIC_IP || 'http://103.14.234.36:3000/api';
      console.log('🌐 Case Status Service - Using static IP API URL:', url);
      return url;
    }
  }

  /**
   * Sync status update with backend
   */
  private static async syncStatusWithBackend(
    caseId: string,
    status: CaseStatus,
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
      console.log('🔍 Case Status Update - URL:', `${API_BASE_URL}/mobile/cases/${caseId}/status`);
      console.log('🔍 Case Status Update - Environment config:', envConfig);

      // Add cache-busting parameter
      const url = `${API_BASE_URL}/mobile/cases/${caseId}/status?t=${Date.now()}`;
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
  private static mapMobileStatusToBackend(status: CaseStatus): string {
    const statusMap: Record<CaseStatus, string> = {
      [CaseStatus.Assigned]: 'PENDING',
      [CaseStatus.InProgress]: 'IN_PROGRESS',
      [CaseStatus.Completed]: 'COMPLETED',
    };

    return statusMap[status] || 'PENDING';
  }


}

export default CaseStatusService;
