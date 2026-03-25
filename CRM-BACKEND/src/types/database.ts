/**
 * Database Row Types
 *
 * Type definitions for database table rows to replace 'any' types
 * in query results and provide type safety for database operations.
 */

// =====================================================
// CORE ENTITY TYPES
// =====================================================

export interface CaseRow {
  id: string;
  caseId: number; // Auto-incrementing user-friendly ID
  title?: string;
  description?: string;
  status: string;
  priority: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  customerCallingCode?: string;
  address?: string;
  pincode?: string;
  latitude?: number;
  longitude?: number;
  clientId?: number;
  productId?: number;
  verificationTypeId?: number;
  verificationType?: string;
  verificationOutcome?: string;
  applicantName?: string;
  applicantType?: string;
  backendContactNumber?: string;
  trigger?: string;
  assignedTo?: string;
  createdByBackendUser?: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  verificationData?: Record<string, unknown>;
}

export interface VerificationTaskRow {
  id: string;
  task_number: string;
  case_id: string;
  verification_type_id: number;
  verification_type_name?: string;
  status: string;
  priority?: string;
  assigned_to?: string;
  assigned_by?: string;
  assigned_at?: Date;
  address?: string;
  pincode?: string;
  trigger?: string;
  applicant_type?: string;
  rate_type_id?: number;
  rate_type_name?: string;
  rate_type_description?: string;
  estimated_amount?: number;
  actual_amount?: number;
  verification_outcome?: string;
  started_at?: Date;
  completed_at?: Date;
  saved_at?: Date;
  is_saved?: boolean;
  revoked_at?: Date;
  revoked_by?: string;
  revocation_reason?: string;
  created_at: Date;
  updated_at: Date;
  assigned_user_name?: string;
  revoked_by_name?: string;
}

export interface UserRow {
  id: string;
  name: string;
  username: string;
  email: string;
  passwordHash: string;
  role: string;
  roleId?: string;
  employeeId?: string;
  designation?: string;
  department?: string;
  profilePhotoUrl?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  roleName?: string;
  permissions?: string[];
}

export interface ClientRow {
  id: number;
  name: string;
  code: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductRow {
  id: number;
  name: string;
  code: string;
  description?: string;
  clientId?: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface VerificationTypeRow {
  id: number;
  name: string;
  code: string;
  description?: string;
  category?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AttachmentRow {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  filePath: string;
  thumbnailPath?: string;
  caseId?: number;
  uploadedBy?: string;
  geoLocation?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface VerificationAttachmentRow {
  id: string;
  case_id: string;
  caseId?: number;
  verification_type: string;
  verification_task_id?: string;
  filename: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  filePath: string;
  thumbnailPath?: string;
  uploadedBy?: string;
  geoLocation?: string;
  photoType?: string;
  submissionId?: string;
  createdAt: Date;
}

export interface LocationRow {
  id: string;
  caseId: number;
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: Date;
  source?: string;
  createdAt: Date;
}

export interface RefreshTokenRow {
  id: string;
  token: string;
  userId: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface RateTypeRow {
  id: number;
  name: string;
  description?: string;
  clientId?: number;
  verificationTypeId?: number;
  baseRate?: number;
  currency?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// =====================================================
// FORM SUBMISSION TYPES
// =====================================================

export interface ResidenceVerificationRow {
  id: string;
  case_id: string;
  verification_task_id?: string;
  customer_name?: string;
  verification_outcome?: string;
  final_status?: string;
  met_person_name?: string;
  met_person_relation?: string;
  address_locatable?: string;
  address_rating?: string;
  house_status?: string;
  total_family_members?: number;
  total_earning?: number;
  working_status?: string;
  company_name?: string;
  staying_period?: string;
  staying_status?: string;
  document_shown_status?: string;
  document_type?: string;
  locality?: string;
  address_structure?: string;
  landmark1?: string;
  landmark2?: string;
  landmark3?: string;
  landmark4?: string;
  political_connection?: string;
  dominated_area?: string;
  feedback_from_neighbour?: string;
  other_observation?: string;
  call_remark?: string;
  created_at: Date;
  updated_at: Date;
  [key: string]: unknown; // Allow additional dynamic fields
}

export interface OfficeVerificationRow {
  id: string;
  case_id: string;
  verification_task_id?: string;
  customer_name?: string;
  verification_outcome?: string;
  final_status?: string;
  company_name?: string;
  business_type?: string;
  number_of_employees?: number;
  office_area?: string;
  address_locatable?: string;
  address_rating?: string;
  locality?: string;
  address_structure?: string;
  landmark1?: string;
  landmark2?: string;
  landmark3?: string;
  landmark4?: string;
  political_connection?: string;
  dominated_area?: string;
  feedback_from_neighbour?: string;
  other_observation?: string;
  call_remark?: string;
  created_at: Date;
  updated_at: Date;
  [key: string]: unknown;
}

export interface BusinessVerificationRow {
  id: string;
  case_id: string;
  verification_task_id?: string;
  customer_name?: string;
  verification_outcome?: string;
  final_status?: string;
  business_name?: string;
  business_type?: string;
  license_number?: string;
  annual_turnover?: number;
  customer_footfall?: string;
  address_locatable?: string;
  address_rating?: string;
  locality?: string;
  address_structure?: string;
  landmark1?: string;
  landmark2?: string;
  landmark3?: string;
  landmark4?: string;
  political_connection?: string;
  dominated_area?: string;
  feedback_from_neighbour?: string;
  other_observation?: string;
  call_remark?: string;
  created_at: Date;
  updated_at: Date;
  [key: string]: unknown;
}

// =====================================================
// SQL QUERY PARAMETER TYPES
// =====================================================

/**
 * Type for SQL query parameter arrays
 * Use this instead of any[] for query parameters
 */
export type QueryParams = (
  | string
  | number
  | boolean
  | Date
  | null
  | undefined
  | number[]
  | string[]
)[];

/**
 * Type for WHERE clause objects in dynamic queries
 * Uses 'unknown' for maximum flexibility with various query builder patterns
 */
export interface WhereClause {
  [key: string]: unknown;
}

/**
 * Type for database query results
 */
export interface QueryResult<T = unknown> {
  rows: T[];
  rowCount: number;
  command: string;
  fields?: unknown[];
}

// =====================================================
// UTILITY TYPES
// =====================================================

/**
 * Generic database row with common fields
 */
export interface BaseRow {
  id: string | number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Type for JSON fields in database
 */
export type JsonValue = string | number | boolean | null | JsonObject | JsonArray;
export interface JsonObject {
  [key: string]: JsonValue;
}
export type JsonArray = JsonValue[];

/**
 * Type for form data that can have dynamic fields
 */
export interface DynamicFormData {
  [key: string]: unknown;
}

export interface DatabaseError extends Error {
  code?: string;
  detail?: string;
  constraint?: string;
  schema?: string;
  table?: string;
  column?: string;
  dataType?: string;
}
