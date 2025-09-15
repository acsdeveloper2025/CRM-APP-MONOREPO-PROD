export interface PincodeAssignment {
  pincodeAssignmentId: number;
  pincodeId: number;
  pincodeCode: string;
  cityName: string;
  stateName: string;
  countryName: string;
  assignedAreas: AreaAssignment[];
  pincodeAssignedAt: string;
  isActive: boolean;
}

export interface AreaAssignment {
  areaAssignmentId: number;
  areaId: number;
  areaName: string;
  assignedAt: string;
}

export interface FieldAgentTerritory {
  userId: string;
  userName: string;
  username: string;
  employeeId: string;
  userIsActive: boolean;
  territoryAssignments: PincodeAssignment[];
}

export interface FieldAgentTerritoryDetail {
  user: {
    id: string;
    name: string;
    username: string;
    employeeId: string;
    role: string;
  };
  territoryAssignments: PincodeAssignment[];
}

export interface TerritoryAssignmentFilters {
  page?: number;
  limit?: number;
  search?: string;
  pincodeId?: number;
  cityId?: number;
  isActive?: boolean;
  sortBy?: 'userName' | 'username' | 'employeeId';
  sortOrder?: 'asc' | 'desc';
}

export interface AssignPincodesRequest {
  pincodeIds: number[];
}

export interface AssignPincodesResponse {
  userId: string;
  assignedPincodes: number;
  totalRequested: number;
  duplicatesSkipped: number;
}

export interface AreaAssignmentRequest {
  pincodeId: number;
  areaIds: number[];
}

export interface AssignAreasRequest {
  assignments: AreaAssignmentRequest[];
}

export interface AssignAreasResponse {
  userId: string;
  totalAssigned: number;
  totalRequested: number;
  assignmentResults: {
    pincodeId: number;
    assigned?: number;
    requested: number;
    duplicatesSkipped?: number;
    error?: string;
  }[];
}

export interface TerritoryAuditEntry {
  id: number;
  userId: string;
  assignmentType: 'PINCODE' | 'AREA';
  assignmentId: number;
  action: 'ASSIGNED' | 'UNASSIGNED' | 'MODIFIED';
  previousData?: any;
  newData: any;
  performedBy: string;
  performedAt: string;
  reason?: string;
}

// For the multi-level selection UI component
export interface PincodeOption {
  id: number;
  code: string;
  cityName: string;
  stateName: string;
  areas: AreaOption[];
}

export interface AreaOption {
  id: number;
  name: string;
  displayOrder?: number;
}

export interface TerritorySelection {
  pincodeId: number;
  selectedAreaIds: number[];
}

// For territory visualization
export interface TerritoryStats {
  totalFieldAgents: number;
  assignedFieldAgents: number;
  unassignedFieldAgents: number;
  totalPincodes: number;
  assignedPincodes: number;
  totalAreas: number;
  assignedAreas: number;
  averageAreasPerAgent: number;
}

export interface TerritoryConflict {
  pincodeId: number;
  pincodeCode: string;
  areaId?: number;
  areaName?: string;
  conflictingAgents: {
    userId: string;
    userName: string;
    employeeId: string;
  }[];
}

// For the assignment management interface
export interface TerritoryAssignmentFormData {
  userId: string;
  pincodeSelections: TerritorySelection[];
}

export interface TerritoryAssignmentValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  conflicts: TerritoryConflict[];
}

// API response types
export interface TerritoryAssignmentListResponse {
  success: boolean;
  data: FieldAgentTerritory[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface TerritoryAssignmentDetailResponse {
  success: boolean;
  data: FieldAgentTerritoryDetail;
}

export interface TerritoryAssignmentActionResponse {
  success: boolean;
  data: AssignPincodesResponse | AssignAreasResponse;
  message: string;
}

// For mobile app integration
export interface MobileTerritoryData {
  userId: string;
  assignedTerritories: {
    pincodeId: number;
    pincodeCode: string;
    cityName: string;
    areas: {
      areaId: number;
      areaName: string;
    }[];
  }[];
  lastSyncAt: string;
}

// For case assignment filtering
export interface TerritoryBasedCaseFilter {
  fieldAgentId: string;
  includeUnassignedTerritories?: boolean;
  pincodeIds?: number[];
  areaIds?: number[];
}

export interface TerritoryAssignmentSummary {
  fieldAgent: {
    id: string;
    name: string;
    employeeId: string;
  };
  totalPincodes: number;
  totalAreas: number;
  recentAssignments: {
    type: 'PINCODE' | 'AREA';
    name: string;
    assignedAt: string;
  }[];
  territoryLoad: 'LOW' | 'MEDIUM' | 'HIGH';
}
