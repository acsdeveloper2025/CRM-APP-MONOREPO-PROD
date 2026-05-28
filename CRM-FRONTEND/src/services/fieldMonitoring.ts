import { apiService } from './api';
import type { ApiResponse } from '@/types/api';
import { validateResponse } from './schemas/runtime';
import { GenericObjectSchema } from './schemas/generic.schema';

export type FieldMonitoringStats = {
  totalFieldUsers: number;
  activeToday: number;
  activeNow: number;
  submissionsToday: number;
  offlineCount: number;
};

export type FieldMonitoringLiveStatus =
  | 'Idle'
  | 'Travelling'
  | 'At Location'
  | 'Submitted'
  | 'Offline';

export type FieldMonitoringRosterQuery = {
  page?: number;
  limit?: number;
  search?: string;
  pincode?: string;
  areaId?: number;
  status?: FieldMonitoringLiveStatus;
  sortBy?: 'name' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
  createdFrom?: string;
  createdTo?: string;
  // P3 truthful-sweep 2026-05-27: map-view viewport bounds. All 4 must
  // be present for the bbox filter to apply server-side. List view
  // never sends bounds.
  boundsSwLat?: number;
  boundsSwLng?: number;
  boundsNeLat?: number;
  boundsNeLng?: number;
};

export type FieldMonitoringRosterItem = {
  id: string;
  name: string;
  username: string;
  employeeId: string | null;
  phone: string | null;
  liveStatus: FieldMonitoringLiveStatus;
  lastHeartbeatAt: string | null;
  lastActivityAt: string | null;
  lastLocation: {
    lat: number;
    lng: number;
    time: string | null;
    freshness: 'fresh' | 'stale';
    source: 'locations' | 'formSubmissions' | 'verificationTasks';
    pingSource?: 'TASK' | 'ADMIN_PING' | 'TRACKING' | null;
    requestedById?: string | null;
    requestedByName?: string | null;
  } | null;
  operatingArea: string | null;
  operatingPincode: string | null;
  assignedTerritory: {
    totalAreas: number;
    totalPincodes: number;
    areaNames: string[];
    pincodeCodes: string[];
  };
  activeAssignmentCount: number;
  currentCaseSummary: {
    caseId: string;
    caseNumber: number;
    customerName: string;
    status: string | null;
    taskId: string;
    taskNumber: string;
    taskStatus: string;
  } | null;
};

export type FieldMonitoringRosterResponse = {
  data: FieldMonitoringRosterItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type FieldMonitoringUserDetail = {
  user: {
    id: string;
    name: string;
    username: string;
    phone: string | null;
    email: string | null;
    employeeId: string | null;
  };
  activity: {
    lastHeartbeatAt: string | null;
    lastTaskActivityAt: string | null;
    lastLocationAt: string | null;
    lastSubmissionAt: string | null;
  };
  liveStatus: FieldMonitoringLiveStatus;
  lastKnownLocation: {
    lat: number;
    lng: number;
    accuracy: number | null;
    recordedAt: string | null;
    source: 'locations' | 'formSubmissions' | 'verificationTasks';
  } | null;
  openAssignments: Array<{
    task: {
      id: string;
      taskNumber: string;
      status: string;
      priority: string | null;
      startedAt: string | null;
      assignedAt: string | null;
      currentAssignedAt: string | null;
      pincode: string | null;
    };
    case: {
      id: string;
      caseNumber: number;
      customerName: string;
      customerPhone: string | null;
      status: string | null;
    };
  }>;
  operatingTerritory: {
    currentOperatingPincode: string | null;
    currentArea: {
      id: number | null;
      name: string | null;
      sourceTaskId: string | null;
    };
    assignedTerritory: {
      areas: Array<{
        areaId: number;
        areaName: string;
        pincodeId: number;
        pincodeCode: string;
      }>;
      pincodes: Array<{
        pincodeId: number;
        pincodeCode: string;
      }>;
    };
  };
};

class FieldMonitoringService {
  private readonly baseUrl = '/field-monitoring';

  async getMonitoringStats(): Promise<ApiResponse<FieldMonitoringStats>> {
    const response = await apiService.get<FieldMonitoringStats>(`${this.baseUrl}/stats`);
    if (response?.success && response.data && typeof response.data === 'object') {
      validateResponse(GenericObjectSchema, response.data, {
        service: 'fieldMonitoring',
        endpoint: 'GET /field-monitoring/stats',
      });
    }
    return response;
  }

  async getMonitoringRoster(
    query: FieldMonitoringRosterQuery = {}
  ): Promise<ApiResponse<FieldMonitoringRosterResponse>> {
    const response = await apiService.get<FieldMonitoringRosterResponse>(
      `${this.baseUrl}/users`,
      query
    );
    if (response?.success && response.data && typeof response.data === 'object') {
      validateResponse(GenericObjectSchema, response.data, {
        service: 'fieldMonitoring',
        endpoint: 'GET /field-monitoring/users',
      });
    }
    return response;
  }

  async getUserMonitoringDetail(userId: string): Promise<ApiResponse<FieldMonitoringUserDetail>> {
    const response = await apiService.get<FieldMonitoringUserDetail>(
      `${this.baseUrl}/users/${userId}`
    );
    if (response?.success && response.data && typeof response.data === 'object') {
      validateResponse(GenericObjectSchema, response.data, {
        service: 'fieldMonitoring',
        endpoint: 'GET /field-monitoring/users/:userId',
      });
    }
    return response;
  }

  // 2026-05-13: on-demand location ping. BE → FCM data-message → mobile
  // captures GPS → POSTs to /api/mobile/location/capture → BE emits
  // `field-monitoring:location-updated` on the socket room. Returns
  // 202 + {requestId} immediately; the FE awaits the WS event with a
  // client-side 20s timeout (handled in FieldMonitoringPage).
  async requestUserLocation(
    userId: string
  ): Promise<ApiResponse<{ requestId: string; dispatchedToTokens: number }>> {
    return apiService.post<{ requestId: string; dispatchedToTokens: number }>(
      `${this.baseUrl}/users/${userId}/request-location`,
      {}
    );
  }

  async exportRoster(query: FieldMonitoringRosterQuery = {}): Promise<Blob> {
    const response = await apiService.getRaw<Blob>(`${this.baseUrl}/export`, query, {
      responseType: 'blob',
    });
    return response.data;
  }
}

export const fieldMonitoringService = new FieldMonitoringService();
