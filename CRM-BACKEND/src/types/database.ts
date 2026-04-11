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
  taskNumber: string;
  caseId: string;
  verificationTypeId: number;
  verificationTypeName?: string;
  status: string;
  priority?: string;
  assignedTo?: string;
  assignedBy?: string;
  assignedAt?: Date;
  address?: string;
  pincode?: string;
  trigger?: string;
  applicantType?: string;
  rateTypeId?: number;
  rateTypeName?: string;
  rateTypeDescription?: string;
  estimatedAmount?: number;
  actualAmount?: number;
  verificationOutcome?: string;
  startedAt?: Date;
  completedAt?: Date;
  savedAt?: Date;
  isSaved?: boolean;
  revokedAt?: Date;
  revokedBy?: string;
  revocationReason?: string;
  createdAt: Date;
  updatedAt: Date;
  assignedUserName?: string;
  revokedByName?: string;
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
  caseId: string;
  verificationType: string;
  verificationTaskId?: string;
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
  caseId: string;
  verificationTaskId?: string;
  customerName?: string;
  verificationOutcome?: string;
  finalStatus?: string;
  metPersonName?: string;
  metPersonRelation?: string;
  addressLocatable?: string;
  addressRating?: string;
  houseStatus?: string;
  totalFamilyMembers?: number;
  totalEarningMember?: number;
  workingStatus?: string;
  companyName?: string;
  stayingPeriod?: string;
  stayingStatus?: string;
  documentShownStatus?: string;
  documentType?: string;
  locality?: string;
  addressStructure?: string;
  landmark1?: string;
  landmark2?: string;
  landmark3?: string;
  landmark4?: string;
  politicalConnection?: string;
  dominatedArea?: string;
  feedbackFromNeighbour?: string;
  otherObservation?: string;
  callRemark?: string;
  createdAt: Date;
  updatedAt: Date;
  [key: string]: unknown; // Allow additional dynamic fields
}

export interface OfficeVerificationRow {
  id: string;
  caseId: string;
  verificationTaskId?: string;
  customerName?: string;
  verificationOutcome?: string;
  finalStatus?: string;
  companyName?: string;
  businessType?: string;
  numberOfEmployees?: number;
  officeArea?: string;
  addressLocatable?: string;
  addressRating?: string;
  locality?: string;
  addressStructure?: string;
  landmark1?: string;
  landmark2?: string;
  landmark3?: string;
  landmark4?: string;
  politicalConnection?: string;
  dominatedArea?: string;
  feedbackFromNeighbour?: string;
  otherObservation?: string;
  callRemark?: string;
  createdAt: Date;
  updatedAt: Date;
  [key: string]: unknown;
}

export interface BusinessVerificationRow {
  id: string;
  caseId: string;
  verificationTaskId?: string;
  customerName?: string;
  verificationOutcome?: string;
  finalStatus?: string;
  businessName?: string;
  businessType?: string;
  licenseNumber?: string;
  annualTurnover?: number;
  customerFootfall?: string;
  addressLocatable?: string;
  addressRating?: string;
  locality?: string;
  addressStructure?: string;
  landmark1?: string;
  landmark2?: string;
  landmark3?: string;
  landmark4?: string;
  politicalConnection?: string;
  dominatedArea?: string;
  feedbackFromNeighbour?: string;
  otherObservation?: string;
  callRemark?: string;
  createdAt: Date;
  updatedAt: Date;
  [key: string]: unknown;
}

// =====================================================
// SQL QUERY PARAMETER TYPES
// =====================================================

/**
 * Type for SQL query parameter arrays
 * Use this instead of any[] for query parameters. Allows `unknown` so that
 * dynamically-built parameter lists (e.g. from `buildInsert`) can be passed
 * without noisy casts; pg itself is responsible for rejecting values it can't
 * serialize at runtime.
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
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents -- intentional fallback for JSONB payloads that may hold any shape; the explicit constituents above document the common cases for readers.
  | unknown
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
