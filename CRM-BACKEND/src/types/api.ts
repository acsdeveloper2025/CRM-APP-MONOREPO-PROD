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
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
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

export interface FileUploadResponse {
  success: boolean;
  message: string;
  data?: {
    id: string;
    name: string;
    url: string;
    thumbnailUrl?: string;
    size: number;
    mimeType: string;
    type: string;
  };
}

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp?: string;
  source?: 'GPS' | 'NETWORK' | 'PASSIVE';
}

export interface GeocodeResponse {
  success: boolean;
  message: string;
  data?: {
    address: string;
    components: {
      street?: string;
      city?: string;
      state?: string;
      pincode?: string;
      country?: string;
    };
    coordinates: {
      latitude: number;
      longitude: number;
    };
  };
}

export interface QRCodeData {
  employeeId: string;
  name: string;
  designation: string;
  department: string;
  validUntil: string;
  verificationUrl: string;
}
