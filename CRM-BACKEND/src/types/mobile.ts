// Mobile App Specific Types

export interface MobileDeviceInfo {
  deviceId: string;
  platform: 'IOS' | 'ANDROID';
  model: string;
  osVersion: string;
  appVersion: string;
  pushToken?: string;
  lastActiveAt?: Date;
}

export interface MobileLoginRequest {
  username: string;
  password: string;
  deviceId: string;
  deviceInfo?: Partial<MobileDeviceInfo>;
}

export interface MobileLoginResponse {
  success: boolean;
  message: string;
  data?: {
    user: {
      id: string;
      name: string;
      username: string;
      email: string;
      role: string;
      employeeId: string;
      designation: string;
      department: string;
      profilePhotoUrl?: string;
    };
    tokens: {
      accessToken: string;
      refreshToken: string;
      expiresIn: number;
    };

  };
}

export interface MobileCaseListRequest {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
  assignedTo?: string;
  priority?: number;
  dateFrom?: string;
  dateTo?: string;
  lastSyncTimestamp?: string;
}

export interface MobileCaseResponse {
  id: string;
  caseId: number; // User-friendly auto-incrementing case ID
  title: string;
  description: string;
  customerName: string;
  customerCallingCode?: string; // Customer Calling Code
  customerPhone?: string;
  customerEmail?: string;
  addressStreet: string;
  addressCity: string;
  addressState: string;
  addressPincode: string;
  latitude?: number;
  longitude?: number;
  status: string;
  priority: number;
  assignedAt: string;
  updatedAt: string;
  completedAt?: string;
  notes?: string; // TRIGGER field
  verificationType?: string;
  verificationOutcome?: string;
  applicantType?: string; // Applicant Type
  backendContactNumber?: string; // Backend Contact Number
  createdByBackendUser?: string; // Created By Backend User name
  assignedToFieldUser?: string; // Assign to Field User name
  client: {
    id: number; // Changed from string to number to match database
    name: string;
    code: string;
  };
  product?: {
    id: number; // Changed from string to number to match database
    name: string;
    code?: string;
  };
  verificationTypeDetails?: {
    id: number; // Changed from string to number to match database
    name: string;
    code?: string;
  };
  attachments?: MobileAttachmentResponse[];
  formData?: any;
  syncStatus?: 'SYNCED' | 'PENDING' | 'CONFLICT';
}

export interface MobileAttachmentResponse {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  thumbnailUrl?: string;
  uploadedAt: string;
  geoLocation?: {
    latitude: number;
    longitude: number;
    accuracy: number;
    timestamp: string;
  };
}

export interface MobileFileUploadRequest {
  caseId: string;
  files: Express.Multer.File[];
  geoLocation?: {
    latitude: number;
    longitude: number;
    accuracy: number;
    timestamp: string;
  };
}

export interface MobileFormSubmissionRequest {
  caseId: string;
  formType: 'RESIDENCE' | 'OFFICE' | 'BUSINESS' | 'BUILDER' | 'RESIDENCE_CUM_OFFICE' | 'DSA_CONNECTOR' | 'PROPERTY_INDIVIDUAL' | 'PROPERTY_APF' | 'NOC';
  formData: {
    [key: string]: any;
    outcome?: string;
    finalStatus?: string;
    verificationType?: string;
  };
  attachmentIds: string[];
  geoLocation: {
    latitude: number;
    longitude: number;
    accuracy: number;
    timestamp: string;
    address?: string;
  };
  photos: {
    attachmentId: string;
    type: 'verification' | 'selfie';
    geoLocation: {
      latitude: number;
      longitude: number;
      accuracy: number;
      timestamp: string;
      address?: string;
    };
    metadata?: {
      fileSize: number;
      dimensions?: { width: number; height: number };
      capturedAt: string;
    };
  }[];
  metadata: {
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
    validationStatus: 'VALID' | 'INVALID' | 'WARNING';
    validationErrors?: string[];
    submissionAttempts: number;
    isOfflineSubmission: boolean;
  };
  images?: {
    dataUrl: string;
    type: 'verification' | 'selfie';
    geoLocation?: {
      latitude: number;
      longitude: number;
      accuracy?: number;
      timestamp?: string;
    };
  }[];
}

// Enhanced form submission data structure for comprehensive display
export interface FormSubmissionData {
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

export interface FormSection {
  id: string;
  title: string;
  description?: string;
  fields: FormField[];
  order: number;
  isRequired?: boolean;
  defaultExpanded?: boolean;
}

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
  attachmentId?: string;
  type: 'verification' | 'selfie';
  url: string;
  thumbnailUrl: string;
  filename?: string;
  size?: number;
  capturedAt?: string;
  geoLocation: FormGeoLocation;
  metadata: {
    fileSize: number;
    mimeType?: string;
    dimensions?: { width: number; height: number };
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
  totalImages?: number;
  totalSelfies?: number;
  verificationDate?: string;
  formType?: string;
}

export interface MobileLocationCaptureRequest {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: string;
  source: 'GPS' | 'NETWORK' | 'PASSIVE';
  caseId?: string;
  activityType?: 'CASE_START' | 'CASE_PROGRESS' | 'CASE_COMPLETE' | 'TRAVEL';
}

export interface MobileLocationValidationRequest {
  latitude: number;
  longitude: number;
  expectedAddress?: string;
  radius?: number;
}

export interface MobileLocationValidationResponse {
  isValid: boolean;
  distance?: number;
  address?: string;
  confidence?: number;
  suggestions?: string[];
}

export interface MobileSyncUploadRequest {
  localChanges: {
    cases: {
      id: string;
      action: 'CREATE' | 'UPDATE' | 'DELETE';
      data: any;
      timestamp: string;
    }[];
    attachments: {
      id: string;
      action: 'CREATE' | 'DELETE';
      data: any;
      timestamp: string;
    }[];
    locations: {
      id: string;
      data: MobileLocationCaptureRequest;
      timestamp: string;
    }[];
  };
  deviceInfo: MobileDeviceInfo;
  lastSyncTimestamp: string;
}

export interface MobileSyncDownloadResponse {
  cases: MobileCaseResponse[];
  deletedCaseIds: string[];
  conflicts: {
    caseId: string;
    localVersion: any;
    serverVersion: any;
    conflictType: 'DATA_CONFLICT' | 'VERSION_CONFLICT';
  }[];
  syncTimestamp: string;
  hasMore: boolean;
}

export interface MobileNotificationRegistrationRequest {
  deviceId: string;
  pushToken: string;
  platform: 'IOS' | 'ANDROID';
  enabled: boolean;
  preferences?: {
    caseUpdates: boolean;
    assignments: boolean;
    reminders: boolean;
    systemAlerts: boolean;
  };
}

export interface MobileAppConfigResponse {
  apiVersion: string;
  minSupportedVersion: string;
  forceUpdateVersion: string;
  features: {
    offlineMode: boolean;
    backgroundSync: boolean;
    biometricAuth: boolean;
    darkMode: boolean;
    analytics: boolean;
  };
  limits: {
    maxFileSize: number;
    maxFilesPerCase: number;
    locationAccuracyThreshold: number;
    syncBatchSize: number;
  };
  endpoints: {
    apiBaseUrl: string;
    wsUrl: string;
  };
}

export interface MobileErrorResponse {
  success: false;
  message: string;
  error: {
    code: string;
    details?: any;
    timestamp: string;
    requestId?: string;
  };
  retryable?: boolean;
  retryAfter?: number;
}

export interface MobileAutoSaveRequest {
  caseId: string;
  formType: 'RESIDENCE' | 'OFFICE';
  formData: any;
  timestamp: string;
}

export interface MobileAutoSaveResponse {
  success: boolean;
  message: string;
  data?: {
    savedAt: string;
    version: number;
  };
}

export interface MobileVersionCheckRequest {
  currentVersion: string;
  platform: 'IOS' | 'ANDROID' | 'WEB';
  buildNumber?: string;
}

export interface MobileVersionCheckResponse {
  success: boolean;
  updateRequired: boolean;
  forceUpdate: boolean;
  urgent?: boolean;
  latestVersion: string;
  currentVersion: string;
  downloadUrl: string;
  releaseNotes: string;
  features: string[];
  bugFixes?: string[];
  size?: string;
  releaseDate?: string;
  buildNumber?: string;
  checkTimestamp: string;
}
