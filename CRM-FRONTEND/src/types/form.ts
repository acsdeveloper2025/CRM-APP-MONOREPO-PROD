import {
  type FormSubmissionStatus,
  type ValidationStatusType,
  type FormFieldType as FormFieldTypeConstant,
} from './constants';

// Re-export types from constants for consistency
export type VerificationType = string;
export type FormSubmissionStatusType = FormSubmissionStatus;
export type ValidationStatus = ValidationStatusType;
export type FormFieldType = FormFieldTypeConstant;

// Common Form Field Types
export interface FormField {
  id: string;
  name: string;
  label: string;
  type:
    | 'text'
    | 'number'
    | 'select'
    | 'multiselect'
    | 'date'
    | 'boolean'
    | 'textarea'
    | 'checkbox'
    | 'radio'
    | 'file';
  value: unknown;
  displayValue?: string;
  options?: { value: string; label: string }[];
  isRequired: boolean;
  validation?: {
    isValid: boolean;
    errors: string[];
  };
}

export interface FormSection {
  id: string;
  title: string;
  description?: string;
  fields: FormField[];
  order: number;
  isRequired?: boolean;
  defaultExpanded?: boolean;
}

export interface FormSubmission {
  id: string;
  caseId: string;
  formType: string;
  verificationType: string;
  outcome: string;
  status: 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED';
  submittedAt: string;
  submittedBy: string;
  submittedByName: string;

  // NEW: Multi-task architecture - link submission to specific verification task
  verificationTaskId?: string;
  verificationTaskNumber?: string;
  verificationTypeName?: string;
  assignedTo?: string;
  assignedToName?: string;
  taskStatus?: string;

  // Form field data organized by sections
  sections: FormSection[];

  // Attachments and photos
  attachments: FormAttachment[];
  photos: FormPhoto[];

  // Location and metadata
  geoLocation: FormGeoLocation;
  metadata: FormMetadata;

  // Validation and review
  validationStatus: 'VALID' | 'INVALID' | 'WARNING';
  validationErrors?: string[];
  reviewNotes?: string;
  reviewedBy?: string;
  reviewedAt?: string;
}

export interface FormAttachment {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  thumbnailUrl?: string;
  uploadedAt: string;
  category: 'DOCUMENT' | 'PHOTO' | 'OTHER';
}

export interface FormPhoto {
  id: string;
  attachmentId: string;
  type: 'verification' | 'selfie';
  url: string;
  thumbnailUrl: string;
  geoLocation: FormGeoLocation;
  metadata: {
    fileSize: number;
    dimensions: { width: number; height: number };
    capturedAt: string;
    deviceInfo?: string;
  };
}

export interface FormGeoLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
}

export interface FormMetadata {
  submissionTimestamp: string;
  deviceInfo: {
    platform: 'IOS' | 'ANDROID';
    model: string;
    osVersion: string;
    appVersion: string;
  };
  networkInfo: {
    type: 'WIFI' | 'CELLULAR' | 'OFFLINE';
    strength?: number;
  };
  formVersion: string;
  submissionAttempts: number;
  isOfflineSubmission: boolean;
  syncedAt?: string;
}

// Specific Form Data Types
export interface ResidenceFormData {
  // Personal Information
  applicantName: string;
  applicantAge?: number;
  applicantRelation: string;
  applicantContact?: string;

  // Address Information
  addressLocatable: string;
  addressRating: string;
  houseStatus: string;
  localityType: string;

  // Verification Details
  personMet: string;
  relationToApplicant: string;
  stayingStatus: string;
  workingStatus: string;
  documentShown: string;
  documentType?: string;

  // Third Party Confirmation
  tpcMetPerson?: string;
  tpcConfirmation?: string;

  // Area Information
  politicalConnection: string;
  dominatedArea: string;
  feedbackFromNeighbour: string;

  // Final Assessment
  finalStatus: string;
  remarks?: string;
  verifierComments?: string;
}

export interface OfficeFormData {
  // Company Information
  companyName: string;
  officeType: string;
  designation: string;

  // Address Information
  addressLocatable: string;
  addressRating: string;
  officeStatus: string;
  localityType: string;

  // Verification Details
  personMet: string;
  workingStatus: string;
  applicantWorkingPremises: string;

  // Third Party Confirmation
  tpcMetPerson?: string;
  tpcConfirmation?: string;

  // Area Information
  politicalConnection: string;
  dominatedArea: string;
  feedbackFromNeighbour: string;

  // Final Assessment
  finalStatus: string;
  remarks?: string;
  verifierComments?: string;
}

export interface BusinessFormData {
  // Business Information
  businessName: string;
  businessType: string;
  ownershipType: string;

  // Address Information
  addressLocatable: string;
  addressRating: string;
  businessStatus: string;
  premisesStatus: string;

  // Verification Details
  businessExistence: string;

  // Area Information
  politicalConnection: string;
  dominatedArea: string;
  feedbackFromNeighbour: string;

  // Final Assessment
  finalStatus: string;
  remarks?: string;
  verifierComments?: string;
}

// Form Template Types
export interface FormTemplate {
  id: string;
  formType: string;
  verificationType: VerificationType;
  outcome: string;
  name: string;
  description: string;
  sections: FormSectionTemplate[];
  version: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FormSectionTemplate {
  id: string;
  title: string;
  description?: string;
  order: number;
  fields: FormFieldTemplate[];
  collapsible?: boolean;
  defaultExpanded?: boolean;
  conditional?: FormCondition;
}

export interface FormFieldTemplate {
  id: string;
  label: string;
  type: FormField['type'];
  name: string;
  order: number;
  required?: boolean;
  placeholder?: string;
  description?: string;
  options?: { label: string; value: string }[];
  validation?: FormValidation;
  conditional?: FormCondition;
}

export interface FormValidation {
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  custom?: string;
}

export interface FormCondition {
  field: string;
  operator: 'equals' | 'notEquals' | 'contains' | 'notContains' | 'greaterThan' | 'lessThan';
  value: unknown;
}
