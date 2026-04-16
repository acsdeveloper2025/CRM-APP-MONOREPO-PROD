/**
 * Centralized Type Definitions for CRM Frontend
 *
 * This file consolidates and re-exports all type definitions to provide
 * a single source of truth for the frontend type system.
 */

// Core API Types
export type {
  ApiResponse,
  PaginationQuery,
  PaginatedResponse,
  ErrorResponse,
  ValidationError,
  CaseListQuery,
} from './api';

// Authentication & User Types
export type { Role, User, LoginRequest, UuidLoginRequest, LoginResponse, AuthState } from './auth';

// User Management Types
export type {
  UserProfile,
  UserActivity,
  UserStats,
  UserClientAssignment,
  UserProductAssignment,
  UserExportData,
  BulkUserOperation,
  UserImportData,
  ActivityQuery,
} from './user';

// Case Management Types
export type { CaseStatus, Case, CaseFilters } from './case';

// Client & Product Types
export type { Client, VerificationType } from './client';

export type { Product, CreateProductData, UpdateProductData, ProductListQuery } from './product';

// Document Type Management Types
export type {
  DocumentType,
  DocumentCategory,
  ClientDocumentType,
  ProductDocumentType,
  CreateDocumentTypeData,
  UpdateDocumentTypeData,
  DocumentTypeFilters,
  DocumentTypeStats,
  AssignDocumentTypesToClientData,
  AssignDocumentTypesToProductData,
  ClientDocumentTypeAssignment,
  ProductDocumentTypeAssignment,
  BulkDocumentTypeOperation,
  DocumentTypeImportData,
  DocumentValidationResult,
  ValidateDocumentRequest,
  DocumentTypeExportData,
  CommonDocumentType,
} from './documentType';

// Document Type Constants
export {
  DOCUMENT_CATEGORIES,
  COMMON_DOCUMENT_TYPES,
  DOCUMENT_TYPE_DISPLAY_NAMES,
  DOCUMENT_TYPE_COLORS,
} from './documentType';

// Form Types
export type {
  FormType,
  VerificationOutcome,
  FormField,
  FormSection,
  FormSubmission,
  FormAttachment,
  FormPhoto,
  FormGeoLocation,
  FormMetadata,
  ResidenceFormData,
  OfficeFormData,
  BusinessFormData,
  FormTemplate,
  FormSectionTemplate,
  FormFieldTemplate,
  FormValidation,
  FormCondition,
} from './form';

// Location Types
export type { Country, State, City, Pincode, PincodeArea, LocationFilters } from './location';

// Dashboard Types
export type {
  DashboardStats,
  DashboardData,
  CaseStatusDistribution,
  ClientCaseStats,
  MonthlyTrend,
  RecentActivity,
  QuickAction,
} from './dashboard';

// Commission Types
export type {
  CommissionRateType,
  CommissionCalculation,
  CommissionSummary,
  CreateCommissionRateTypeData,
  CreateCommissionCalculationData,
  UpdateCommissionCalculationData,
  BulkCommissionOperation,
  CommissionExportData,
  CommissionCalculationInput,
} from './commission';

// Rate Management Types
export type { Rate, CreateRateData, UpdateRateData } from './rateManagement';

// Territory Assignment Types
export type { TerritoryAssignment } from './territoryAssignment';

// Billing Types
export type { InvoiceItem, CreateInvoiceData, UpdateInvoiceData } from './billing';

// Reports Types
export type { ReportFilters, FinancialReport, ReportSummary } from './reports';

// Common Base Types
export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface BaseEntityWithUser extends BaseEntity {
  createdBy?: string;
  updatedBy?: string;
}

// ID Types - Standardized
export type EntityId = string; // UUID for primary entities
export type NumericId = number; // For legacy/reference entities
export type MixedId = string | number; // For backward compatibility

// Status Types
export type Status = 'ACTIVE' | 'INACTIVE' | 'PENDING' | 'ARCHIVED';
export type ProcessingStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';

// Common Filter Types
export interface BaseFilters {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  dateFrom?: string;
  dateTo?: string;
}

export interface StatusFilter {
  status?: Status;
  isActive?: boolean;
}

// File Upload Types
export interface FileUpload {
  id: string;
  name: string;
  originalName: string;
  size: number;
  mimeType: string;
  url: string;
  thumbnailUrl?: string;
  uploadedAt: string;
  uploadedBy: string;
}

export interface FileUploadProgress {
  fileId: string;
  progress: number;
  status: 'uploading' | 'completed' | 'error';
  error?: string;
}

// Geolocation Types
export interface GeoLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp?: string;
  source?: 'GPS' | 'NETWORK' | 'MANUAL';
}

export interface Address {
  street?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
}

// Notification Types
export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  createdAt: string;
  actionUrl?: string;
  data?: Record<string, unknown>;
}

// Theme Types
export type ThemeMode = 'light' | 'dark' | 'system';
export type ColorScheme = 'blue' | 'green' | 'purple' | 'orange';

// Permission Types
export interface Permission {
  resource: string;
  actions: string[];
}

export interface RolePermissions {
  [resource: string]: {
    [action: string]: boolean;
  };
}

// Bulk Operation Types
export interface BulkOperation<T = unknown> {
  ids: string[];
  operation: string;
  data?: T;
  reason?: string;
}

export interface BulkOperationResult {
  success: number;
  failed: number;
  errors: Array<{
    id: string;
    error: string;
  }>;
}

// Export/Import Types
export interface ExportOptions {
  format: 'excel' | 'csv' | 'pdf';
  fields?: string[];
  filters?: Record<string, unknown>;
  dateRange?: {
    from: string;
    to: string;
  };
}

export interface ImportResult<T = unknown> {
  success: number;
  failed: number;
  data: T[];
  errors: Array<{
    row: number;
    field?: string;
    error: string;
  }>;
}

// Utility Types
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;
export type PartialExcept<T, K extends keyof T> = Partial<T> & Pick<T, K>;

// Form Utility Types
export type FormFieldValue = string | number | boolean | string[] | File | File[];
export type FormData = Record<string, FormFieldValue>;
export type FormErrors = Record<string, string>;
export type FormTouched = Record<string, boolean>;

// API Utility Types
export type ApiMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type ApiHeaders = Record<string, string>;
export type ApiParams = Record<string, unknown>;

// Component Prop Types
export interface ComponentProps {
  className?: string;
  children?: React.ReactNode;
}

export interface LoadingProps {
  loading?: boolean;
  loadingText?: string;
}

export interface ErrorProps {
  error?: string | Error;
  onRetry?: () => void;
}

// Table/List Types
export interface TableColumn<T = unknown> {
  key: string;
  title: string;
  dataIndex?: keyof T;
  render?: (value: unknown, record: T, index: number) => React.ReactNode;
  sortable?: boolean;
  filterable?: boolean;
  width?: number | string;
  align?: 'left' | 'center' | 'right';
}

export interface TableProps<T = unknown> {
  data: T[];
  columns: TableColumn<T>[];
  loading?: boolean;
  pagination?: {
    current: number;
    pageSize: number;
    total: number;
    onChange: (page: number, pageSize: number) => void;
  };
  rowKey?: keyof T | ((record: T) => string);
  onRowClick?: (record: T) => void;
  selectedRowKeys?: string[];
  onSelectionChange?: (selectedRowKeys: string[], selectedRows: T[]) => void;
}
