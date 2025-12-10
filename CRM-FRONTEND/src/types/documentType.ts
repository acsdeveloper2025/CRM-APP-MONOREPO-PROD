import { BaseEntity } from './index';

// Document Type Categories
export const DOCUMENT_CATEGORIES = {
  IDENTITY: 'IDENTITY',
  ADDRESS: 'ADDRESS', 
  FINANCIAL: 'FINANCIAL',
  EDUCATION: 'EDUCATION',
  BUSINESS: 'BUSINESS',
  OTHER: 'OTHER'
} as const;

export type DocumentCategory = typeof DOCUMENT_CATEGORIES[keyof typeof DOCUMENT_CATEGORIES];

// Document Type Interface
export interface DocumentType extends Omit<BaseEntity, 'id'> {
  id: number; // Numeric ID for document types (SERIAL)
  name: string; // e.g., "Aadhaar Card", "PAN Card"
  code: string; // e.g., "AADHAAR", "PAN"
  description?: string;
  category: DocumentCategory;
  
  // Document properties
  isGovernmentIssued?: boolean;
  requiresVerification?: boolean;
  validityPeriodMonths?: number; // NULL for permanent documents
  
  // Validation rules
  formatPattern?: string; // Regex pattern for validation
  minLength?: number;
  maxLength?: number;
  
  // Status and metadata
  isActive?: boolean;
  sortOrder?: number;
  clientCount?: number;
}

// Client-Document Type Mapping
export interface ClientDocumentType {
  id: number;
  clientId: number;
  documentTypeId: number;
  
  // Mapping properties
  isRequired?: boolean;
  isActive?: boolean;
  priority?: number;
  
  // Client-specific rules
  clientSpecificRules?: Record<string, unknown>;
  
  // Populated relations
  documentType?: DocumentType;
  
  // Audit fields
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
}

// Product-Document Type Mapping
export interface ProductDocumentType {
  id: number;
  productId: number;
  documentTypeId: number;
  
  // Mapping properties
  isRequired?: boolean;
  isActive?: boolean;
  priority?: number;
  
  // Product-specific rules
  productSpecificRules?: Record<string, unknown>;
  
  // Populated relations
  documentType?: DocumentType;
  
  // Audit fields
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
}

// API Request/Response Types
export interface CreateDocumentTypeData {
  name: string;
  code: string;
  description?: string;
  category: DocumentCategory;
  isGovernmentIssued?: boolean;
  requiresVerification?: boolean;
  validityPeriodMonths?: number;
  formatPattern?: string;
  minLength?: number;
  maxLength?: number;
  sortOrder?: number;
}

export interface UpdateDocumentTypeData {
  name?: string;
  code?: string;
  description?: string;
  category?: DocumentCategory;
  isGovernmentIssued?: boolean;
  requiresVerification?: boolean;
  validityPeriodMonths?: number;
  formatPattern?: string;
  minLength?: number;
  maxLength?: number;
  isActive?: boolean;
  sortOrder?: number;
}

export interface DocumentTypeFilters {
  page?: number;
  limit?: number;
  search?: string;
  category?: DocumentCategory;
  isActive?: boolean;
  isGovernmentIssued?: boolean;
  requiresVerification?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface DocumentTypeStats {
  totalDocumentTypes: number;
  activeDocumentTypes: number;
  inactiveDocumentTypes: number;
  documentTypesByCategory: {
    category: DocumentCategory;
    count: number;
  }[];
  governmentIssuedCount: number;
  requiresVerificationCount: number;
}

// Client Document Type Assignment
export interface AssignDocumentTypesToClientData {
  clientId: number;
  documentTypeIds: number[];
  isRequired?: boolean;
}

export interface ClientDocumentTypeAssignment {
  clientId: number;
  documentTypeId: number;
  isRequired: boolean;
  priority: number;
}

// Product Document Type Assignment
export interface AssignDocumentTypesToProductData {
  productId: number;
  documentTypeIds: number[];
  isRequired?: boolean;
}

export interface ProductDocumentTypeAssignment {
  productId: number;
  documentTypeId: number;
  isRequired: boolean;
  priority: number;
}

// Bulk Operations
export interface BulkDocumentTypeOperation {
  documentTypeIds: number[];
  operation: 'activate' | 'deactivate' | 'delete' | 'updateCategory';
  data?: {
    category?: DocumentCategory;
    isActive?: boolean;
    reason?: string;
  };
}

export interface DocumentTypeImportData {
  name: string;
  code: string;
  description?: string;
  category: DocumentCategory;
  isGovernmentIssued?: boolean;
  requiresVerification?: boolean;
  validityPeriodMonths?: number;
  formatPattern?: string;
  minLength?: number;
  maxLength?: number;
  sortOrder?: number;
}

// Document Validation
export interface DocumentValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  documentType: DocumentType;
  documentNumber?: string;
}

export interface ValidateDocumentRequest {
  documentTypeId: number;
  documentNumber: string;
  additionalData?: Record<string, unknown>;
}

// Export Data
export interface DocumentTypeExportData {
  id: number;
  name: string;
  code: string;
  description: string;
  category: string;
  isGovernmentIssued: boolean;
  requiresVerification: boolean;
  validityPeriodMonths: number | null;
  formatPattern: string | null;
  minLength: number | null;
  maxLength: number | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  
  // Related data
  clientCount: number;
  productCount: number;
  usageCount: number;
}

// Common Document Types (for quick reference)
export const COMMON_DOCUMENT_TYPES = {
  // Identity
  AADHAAR: 'AADHAAR',
  PAN: 'PAN',
  VOTER_ID: 'VOTER_ID',
  DRIVING_LICENSE: 'DRIVING_LICENSE',
  PASSPORT: 'PASSPORT',
  
  // Address
  ELECTRICITY_BILL: 'ELECTRICITY_BILL',
  GAS_BILL: 'GAS_BILL',
  WATER_BILL: 'WATER_BILL',
  BANK_STATEMENT: 'BANK_STATEMENT',
  RENT_AGREEMENT: 'RENT_AGREEMENT',
  
  // Financial
  BANK_ACCOUNT: 'BANK_ACCOUNT',
  SALARY_CERTIFICATE: 'SALARY_CERTIFICATE',
  ITR: 'ITR',
  FORM_16: 'FORM_16',
  
  // Business
  GST_CERTIFICATE: 'GST_CERTIFICATE',
  TRADE_LICENSE: 'TRADE_LICENSE',
  SHOP_ACT_LICENSE: 'SHOP_ACT_LICENSE',
  MSME_CERTIFICATE: 'MSME_CERTIFICATE'
} as const;

export type CommonDocumentType = typeof COMMON_DOCUMENT_TYPES[keyof typeof COMMON_DOCUMENT_TYPES];

// Document Type Display Names
export const DOCUMENT_TYPE_DISPLAY_NAMES: Record<DocumentCategory, string> = {
  [DOCUMENT_CATEGORIES.IDENTITY]: 'Identity Documents',
  [DOCUMENT_CATEGORIES.ADDRESS]: 'Address Proof Documents',
  [DOCUMENT_CATEGORIES.FINANCIAL]: 'Financial Documents',
  [DOCUMENT_CATEGORIES.EDUCATION]: 'Educational Documents',
  [DOCUMENT_CATEGORIES.BUSINESS]: 'Business Documents',
  [DOCUMENT_CATEGORIES.OTHER]: 'Other Documents'
};

// Document Type Colors (for UI)
export const DOCUMENT_TYPE_COLORS: Record<DocumentCategory, string> = {
  [DOCUMENT_CATEGORIES.IDENTITY]: 'blue',
  [DOCUMENT_CATEGORIES.ADDRESS]: 'green',
  [DOCUMENT_CATEGORIES.FINANCIAL]: 'purple',
  [DOCUMENT_CATEGORIES.EDUCATION]: 'orange',
  [DOCUMENT_CATEGORIES.BUSINESS]: 'red',
  [DOCUMENT_CATEGORIES.OTHER]: 'gray'
};
