/**
 * Shared Constants for CRM Frontend
 * 
 * This file contains all constant values used across the application
 * to ensure consistency and prevent magic strings/numbers.
 */

// User Roles
export const USER_ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  BACKEND_USER: 'BACKEND_USER',
  FIELD_AGENT: 'FIELD_AGENT',
  MANAGER: 'MANAGER',
  REPORT_PERSON: 'REPORT_PERSON'
} as const;

export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];

// Case Status
export const CASE_STATUS = {
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  REWORK_REQUIRED: 'REWORK_REQUIRED'
} as const;

export type CaseStatusType = typeof CASE_STATUS[keyof typeof CASE_STATUS];

// Case Priority
export const CASE_PRIORITY = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  URGENT: 4,
  CRITICAL: 5
} as const;

export type CasePriorityType = typeof CASE_PRIORITY[keyof typeof CASE_PRIORITY];

// Form Types
export const FORM_TYPES = {
  RESIDENCE: 'RESIDENCE',
  OFFICE: 'OFFICE',
  BUSINESS: 'BUSINESS',
  BUILDER: 'BUILDER',
  DSA_CONNECTOR: 'DSA_CONNECTOR',
  NOC: 'NOC',
  PROPERTY_APF: 'PROPERTY_APF',
  PROPERTY_INDIVIDUAL: 'PROPERTY_INDIVIDUAL',
  RESIDENCE_CUM_OFFICE: 'RESIDENCE_CUM_OFFICE'
} as const;

export type FormType = typeof FORM_TYPES[keyof typeof FORM_TYPES];

// Verification Outcomes
export const VERIFICATION_OUTCOMES = {
  POSITIVE: 'POSITIVE',
  NEGATIVE: 'NEGATIVE',
  SHIFTED: 'SHIFTED',
  NSP: 'NSP', // No Such Person
  ENTRY_RESTRICTED: 'ENTRY_RESTRICTED',
  UNTRACEABLE: 'UNTRACEABLE',
  REFER_TO_CREDIT: 'REFER_TO_CREDIT'
} as const;

export type VerificationOutcome = typeof VERIFICATION_OUTCOMES[keyof typeof VERIFICATION_OUTCOMES];

// Form Submission Status
export const FORM_SUBMISSION_STATUS = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  UNDER_REVIEW: 'UNDER_REVIEW',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED'
} as const;

export type FormSubmissionStatus = typeof FORM_SUBMISSION_STATUS[keyof typeof FORM_SUBMISSION_STATUS];

// Validation Status
export const VALIDATION_STATUS = {
  PENDING: 'PENDING',
  VALID: 'VALID',
  INVALID: 'INVALID',
  WARNING: 'WARNING',
  REQUIRES_REVIEW: 'REQUIRES_REVIEW'
} as const;

export type ValidationStatusType = typeof VALIDATION_STATUS[keyof typeof VALIDATION_STATUS];

// File Types
export const FILE_TYPES = {
  IMAGE: 'image',
  DOCUMENT: 'document',
  VIDEO: 'video',
  AUDIO: 'audio'
} as const;

export type FileType = typeof FILE_TYPES[keyof typeof FILE_TYPES];

// Supported MIME Types
export const SUPPORTED_MIME_TYPES = {
  IMAGES: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
  DOCUMENTS: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  VIDEOS: ['video/mp4', 'video/avi', 'video/mov', 'video/wmv'],
  AUDIO: ['audio/mp3', 'audio/wav', 'audio/aac']
} as const;

// File Size Limits (in bytes)
export const FILE_SIZE_LIMITS = {
  IMAGE: 10 * 1024 * 1024, // 10MB
  DOCUMENT: 25 * 1024 * 1024, // 25MB
  VIDEO: 100 * 1024 * 1024, // 100MB
  AUDIO: 50 * 1024 * 1024 // 50MB
} as const;

// Notification Types
export const NOTIFICATION_TYPES = {
  INFO: 'info',
  SUCCESS: 'success',
  WARNING: 'warning',
  ERROR: 'error'
} as const;

export type NotificationType = typeof NOTIFICATION_TYPES[keyof typeof NOTIFICATION_TYPES];

// WebSocket Event Types
export const WEBSOCKET_EVENTS = {
  CASE_ASSIGNED: 'case_assigned',
  CASE_UPDATED: 'case_updated',
  CASE_COMPLETED: 'case_completed',
  FORM_SUBMITTED: 'form_submitted',
  NOTIFICATION: 'notification',
  USER_STATUS: 'user_status',
  SYSTEM_ALERT: 'system_alert'
} as const;

export type WebSocketEventType = typeof WEBSOCKET_EVENTS[keyof typeof WEBSOCKET_EVENTS];

// API Response Status
export const API_STATUS = {
  SUCCESS: 'success',
  ERROR: 'error',
  LOADING: 'loading',
  IDLE: 'idle'
} as const;

export type ApiStatus = typeof API_STATUS[keyof typeof API_STATUS];

// Theme Constants
export const THEME_MODES = {
  LIGHT: 'light',
  DARK: 'dark',
  SYSTEM: 'system'
} as const;

export type ThemeMode = typeof THEME_MODES[keyof typeof THEME_MODES];

// Color Schemes
export const COLOR_SCHEMES = {
  BLUE: 'blue',
  GREEN: 'green',
  PURPLE: 'purple',
  ORANGE: 'orange'
} as const;

export type ColorScheme = typeof COLOR_SCHEMES[keyof typeof COLOR_SCHEMES];

// Pagination Constants
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
  PAGE_SIZE_OPTIONS: [10, 20, 50, 100]
} as const;

// Sort Orders
export const SORT_ORDERS = {
  ASC: 'asc',
  DESC: 'desc'
} as const;

export type SortOrder = typeof SORT_ORDERS[keyof typeof SORT_ORDERS];

// Date Formats
export const DATE_FORMATS = {
  DISPLAY: 'DD/MM/YYYY',
  DISPLAY_WITH_TIME: 'DD/MM/YYYY HH:mm',
  API: 'YYYY-MM-DD',
  API_WITH_TIME: 'YYYY-MM-DDTHH:mm:ss.SSSZ',
  FILENAME: 'YYYY-MM-DD_HH-mm-ss'
} as const;

// Export Formats
export const EXPORT_FORMATS = {
  EXCEL: 'excel',
  CSV: 'csv',
  PDF: 'pdf'
} as const;

export type ExportFormat = typeof EXPORT_FORMATS[keyof typeof EXPORT_FORMATS];

// Commission Status
export const COMMISSION_STATUS = {
  PENDING: 'PENDING',
  CALCULATED: 'CALCULATED',
  APPROVED: 'APPROVED',
  PAID: 'PAID',
  REJECTED: 'REJECTED'
} as const;

export type CommissionStatus = typeof COMMISSION_STATUS[keyof typeof COMMISSION_STATUS];

// Rate Types
export const RATE_TYPES = {
  LOCAL: 'LOCAL',
  OGL: 'OGL', // Out of Geolocation
  OUTSTATION: 'OUTSTATION',
  STANDARD: 'STANDARD'
} as const;

export type RateType = typeof RATE_TYPES[keyof typeof RATE_TYPES];

// Currency
export const CURRENCIES = {
  INR: 'INR',
  USD: 'USD',
  EUR: 'EUR'
} as const;

export type Currency = typeof CURRENCIES[keyof typeof CURRENCIES];

// Form Field Types
export const FORM_FIELD_TYPES = {
  TEXT: 'text',
  EMAIL: 'email',
  PASSWORD: 'password',
  NUMBER: 'number',
  TEXTAREA: 'textarea',
  SELECT: 'select',
  MULTISELECT: 'multiselect',
  CHECKBOX: 'checkbox',
  RADIO: 'radio',
  DATE: 'date',
  TIME: 'time',
  DATETIME: 'datetime',
  FILE: 'file',
  IMAGE: 'image',
  LOCATION: 'location',
  SIGNATURE: 'signature'
} as const;

export type FormFieldType = typeof FORM_FIELD_TYPES[keyof typeof FORM_FIELD_TYPES];

// Validation Rules
export const VALIDATION_RULES = {
  REQUIRED: 'required',
  EMAIL: 'email',
  PHONE: 'phone',
  MIN_LENGTH: 'minLength',
  MAX_LENGTH: 'maxLength',
  MIN_VALUE: 'minValue',
  MAX_VALUE: 'maxValue',
  PATTERN: 'pattern',
  CUSTOM: 'custom'
} as const;

export type ValidationRule = typeof VALIDATION_RULES[keyof typeof VALIDATION_RULES];

// Error Codes
export const ERROR_CODES = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  SERVER_ERROR: 'SERVER_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT: 'TIMEOUT'
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];

// Local Storage Keys
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'crm_auth_token',
  REFRESH_TOKEN: 'crm_refresh_token',
  USER_DATA: 'crm_user_data',
  THEME_MODE: 'crm_theme_mode',
  COLOR_SCHEME: 'crm_color_scheme',
  SIDEBAR_COLLAPSED: 'crm_sidebar_collapsed',
  FORM_DRAFT: 'crm_form_draft_',
  LAST_ROUTE: 'crm_last_route'
} as const;

// API Endpoints
export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/auth/login',
    LOGOUT: '/auth/logout',
    REFRESH: '/auth/refresh',
    UUID_LOGIN: '/auth/uuid-login'
  },
  CASES: {
    LIST: '/cases',
    DETAIL: '/cases/:id',
    CREATE: '/cases',
    UPDATE: '/cases/:id',
    DELETE: '/cases/:id',
    BULK: '/cases/bulk',
    EXPORT: '/cases/export'
  },
  USERS: {
    LIST: '/users',
    DETAIL: '/users/:id',
    CREATE: '/users',
    UPDATE: '/users/:id',
    PROFILE: '/user/profile',
    ACTIVITIES: '/users/:id/activities'
  },
  FORMS: {
    SUBMISSIONS: '/forms/submissions',
    SUBMIT: '/forms/submissions',
    VALIDATE: '/forms/submissions/:id/validate'
  },
  ATTACHMENTS: {
    UPLOAD: '/attachments/upload',
    DETAIL: '/attachments/:id',
    DELETE: '/attachments/:id',
    CASE_ATTACHMENTS: '/attachments/case/:caseId'
  },
  DASHBOARD: {
    STATS: '/dashboard/stats',
    ACTIVITIES: '/dashboard/activities'
  }
} as const;

// Regular Expressions
export const REGEX_PATTERNS = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE: /^[+]?[\d\s\-()]{10,15}$/,
  PINCODE: /^\d{6}$/,
  PAN: /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/,
  AADHAAR: /^\d{12}$/,
  IFSC: /^[A-Z]{4}0[A-Z0-9]{6}$/,
  EMPLOYEE_ID: /^[A-Z0-9]{4,10}$/
} as const;
