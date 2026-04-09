export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  error?: {
    code: string;
    details?: unknown;
  };
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  statistics?: unknown;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
}

export interface CaseListQuery extends PaginationQuery {
  status?: string;
  search?: string;
  assignedTo?: string;
  clientId?: string;
  priority?: number;
  dateFrom?: string;
  dateTo?: string;
}

export interface ErrorResponse {
  success: false;
  message: string;
  error: {
    code: string;
    details?: unknown;
  };
}

export interface ValidationError {
  field: string;
  message: string;
  value?: unknown;
}

export interface PaginatedResponse<T = unknown> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// API Error Response type for error handling
export interface ApiErrorResponse {
  response?: {
    data?: {
      message?: string;
      error?: string;
      details?: unknown;
    };
    status?: number;
    statusText?: string;
  };
  message?: string;
  code?: string;
  name?: string;
}

// Chart and Analytics Types
export interface ChartDataPoint {
  name: string;
  value: number;
  [key: string]: string | number;
}

export interface DashboardStats {
  totalCases?: number;
  pendingCases?: number;
  inProgressCases?: number;
  completedCases?: number;
  [key: string]: number | undefined;
}

// WebSocket Types
export interface NotificationPayload {
  id: string;
  type: string;
  message: string;
  title?: string;
  data?: Record<string, unknown>;
  createdAt: string;
  createdAt?: string;
  read?: boolean;
  userId?: string;
  priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  caseId?: string;
  caseNumber?: string;
  actionUrl?: string;
  actionType?: string;
}

export interface WebSocketMessage<T = unknown> {
  type: string;
  payload: T;
  timestamp?: string;
}

// Form Types
export type FormFieldValue = string | number | boolean | null | undefined | string[] | number[];

export interface FormSubmissionData {
  [key: string]: FormFieldValue;
}

// Filter Types
export interface FilterOption {
  value: string | number;
  label: string;
  description?: string;
}
