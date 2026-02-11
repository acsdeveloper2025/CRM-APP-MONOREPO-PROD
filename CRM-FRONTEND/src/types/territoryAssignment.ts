/**
 * Territory Assignment Types
 * Used for managing field agent assignments to pincodes and areas
 */

// Area assignment within a pincode
export interface AreaAssignment {
  id: number;
  areaId: number;
  areaName: string;
  assignedAt: string;
}

// Pincode assignment with nested area assignments
export interface PincodeAssignment {
  assignmentId: number;
  pincodeId: number;
  pincodeCode: string;
  cityName: string;
  stateName: string;
  assignedAt: string;
  areaAssignments: AreaAssignment[];
}

// User's complete territory assignments
export interface UserTerritoryAssignments {
  pincodeAssignments: PincodeAssignment[];
}

// Territory assignment for bulk save (request format)
export interface TerritoryAssignment {
  pincodeId: number;
  areaIds: number[];
}

// Bulk save request
export interface BulkSaveTerritoryAssignmentsRequest {
  assignments: TerritoryAssignment[];
}

// Bulk save response
export interface BulkSaveTerritoryAssignmentsResponse {
  success: boolean;
  data: {
    pincodeAssignmentsCreated: number;
    areaAssignmentsCreated: number;
    message: string;
  };
}

// Pincode with city information (for selection)
export interface PincodeWithCity {
  id: number;
  code: string;
  cityId: number;
  cityName: string;
  stateId: number;
  stateName: string;
  countryId: number;
  countryName: string;
}

// Area information
export interface Area {
  id: number;
  name: string;
}

// Areas grouped by pincode (for batch fetch)
export interface AreasByPincode {
  [pincodeId: number]: Area[];
}

// Summary item for display
export interface AssignmentSummaryItem {
  pincodeId: number;
  pincodeCode: string;
  cityName: string;
  areaIds: number[];
  areaNames: string[];
}

// Available field agent (for task assignment filtering)
export interface AvailableFieldAgent {
  id: string;
  name: string;
  email: string;
  employeeId: string | null;
}

// Response type for field agents assigned to territory (via pincode)
export interface FieldAgentAssignment {
  userId: string;
  userName: string;
  username: string;
  employeeId: string;
  isActive: boolean;
  email?: string; // Optional as it might not be in the lightweight response
}
