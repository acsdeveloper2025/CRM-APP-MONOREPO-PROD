import { apiService } from './api';
import type { ApiResponse } from '@/types/api';

export type FieldMonitoringStats = {
  totalFieldUsers: number;
  activeToday: number;
  activeNow: number;
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
    source: 'locations' | 'form_submissions' | 'verificationTasks';
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
    source: 'locations' | 'form_submissions' | 'verificationTasks';
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
    return apiService.get<FieldMonitoringStats>(`${this.baseUrl}/stats`);
  }

  async getMonitoringRoster(
    query: FieldMonitoringRosterQuery = {}
  ): Promise<ApiResponse<FieldMonitoringRosterResponse>> {
    return apiService.get<FieldMonitoringRosterResponse>(`${this.baseUrl}/users`, query);
  }

  async getUserMonitoringDetail(userId: string): Promise<ApiResponse<FieldMonitoringUserDetail>> {
    return apiService.get<FieldMonitoringUserDetail>(`${this.baseUrl}/users/${userId}`);
  }
}

export const fieldMonitoringService = new FieldMonitoringService();
