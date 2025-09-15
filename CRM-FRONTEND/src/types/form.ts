// Form Types and Enums
export const FormType = {
  // Residence Forms
  RESIDENCE_POSITIVE: 'residence-positive',
  RESIDENCE_SHIFTED: 'residence-shifted',
  RESIDENCE_NSP: 'residence-nsp',
  RESIDENCE_ENTRY_RESTRICTED: 'residence-entry-restricted',
  RESIDENCE_UNTRACEABLE: 'residence-untraceable',

  // Office Forms
  OFFICE_POSITIVE: 'office-positive',
  OFFICE_SHIFTED: 'office-shifted',
  OFFICE_NSP: 'office-nsp',
  OFFICE_ENTRY_RESTRICTED: 'office-entry-restricted',
  OFFICE_UNTRACEABLE: 'office-untraceable',

  // Business Forms
  BUSINESS_POSITIVE: 'business-positive',
  BUSINESS_SHIFTED: 'business-shifted',
  BUSINESS_NSP: 'business-nsp',
  BUSINESS_ENTRY_RESTRICTED: 'business-entry-restricted',
  BUSINESS_UNTRACEABLE: 'business-untraceable',

  // Residence-cum-Office Forms
  RESIDENCE_CUM_OFFICE_POSITIVE: 'residence-cum-office-positive',
  RESIDENCE_CUM_OFFICE_SHIFTED: 'residence-cum-office-shifted',
  RESIDENCE_CUM_OFFICE_NSP: 'residence-cum-office-nsp',
  RESIDENCE_CUM_OFFICE_ENTRY_RESTRICTED: 'residence-cum-office-entry-restricted',
  RESIDENCE_CUM_OFFICE_UNTRACEABLE: 'residence-cum-office-untraceable',
} as const;

export type FormType = typeof FormType[keyof typeof FormType];

export const VerificationType = {
  RESIDENCE: 'Residence',
  OFFICE: 'Office',
  BUSINESS: 'Business',
  RESIDENCE_CUM_OFFICE: 'Residence-cum-office',
  BUILDER: 'Builder',
  NOC: 'NOC',
  CONNECTOR: 'DSA/DST & Connector',
  PROPERTY_APF: 'Property APF',
  PROPERTY_INDIVIDUAL: 'Property Individual',
} as const;

export type VerificationType = typeof VerificationType[keyof typeof VerificationType];

export const VerificationOutcome = {
  POSITIVE: 'Positive',
  SHIFTED: 'Shifted',
  NSP: 'NSP',
  ENTRY_RESTRICTED: 'Entry Restricted',
  UNTRACEABLE: 'Untraceable',
} as const;

export type VerificationOutcome = typeof VerificationOutcome[keyof typeof VerificationOutcome];

// Common Form Field Types
export interface FormField {
  id: string;
  name: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'multiselect' | 'date' | 'boolean' | 'textarea';
  value: any;
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
  applicantExistence: string;
  
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
  formType: FormType;
  verificationType: VerificationType;
  outcome: VerificationOutcome;
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
  value: any;
}

// Form Viewer Props
export interface FormViewerProps {
  submission: FormSubmission;
  template?: FormTemplate;
  readonly?: boolean;
  showAttachments?: boolean;
  showLocation?: boolean;
  showMetadata?: boolean;
  onFieldChange?: (fieldId: string, value: any) => void;
  onSectionToggle?: (sectionId: string, expanded: boolean) => void;
}
