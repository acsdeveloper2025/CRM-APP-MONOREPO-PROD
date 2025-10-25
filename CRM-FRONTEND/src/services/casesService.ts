/**
 * Modern Cases Service
 * 
 * Refactored to use BaseApiService and eliminate code duplication.
 * Provides comprehensive case management functionality.
 */

import { BaseApiService } from './base';
import { API_ENDPOINTS } from '@/types/constants';
import type { 
  Case, 
  CaseFilters, 
  CaseStatus, 
  CasePriority 
} from '@/types/case';
import type { 
  ApiResponse, 
  PaginatedResponse, 
  PaginationQuery,
  BulkOperationResult,
  ExportOptions
} from '@/types';

// Request/Response interfaces
export interface CaseListQuery extends PaginationQuery {
  status?: CaseStatus;
  search?: string;
  assignedTo?: string;
  clientId?: number;
  priority?: CasePriority;
  dateFrom?: string;
  dateTo?: string;
  verificationTypeId?: number;
  productId?: number;
}

export interface CreateCaseData {
  // Core case fields
  customerName: string;
  customerCallingCode?: string;
  customerPhone?: string;
  customerEmail?: string;
  verificationType?: string;
  verificationTypeId?: number;
  address: string;
  pincode: string;
  assignedToId: string;
  clientId: number;
  productId?: number;
  priority: CasePriority;
  trigger?: string;
  rateTypeId?: number;
  
  // Applicant information
  applicantType?: string;
  applicantName?: string;
  applicantPhone?: string;
  applicantEmail?: string;
  panNumber?: string;
  aadhaarNumber?: string;
  bankAccountNumber?: string;
  bankIfscCode?: string;
  
  // Backend fields
  backendContactNumber?: string;
  createdByBackendUser?: string;
  
  // Deduplication fields
  deduplicationDecision?: string;
  deduplicationRationale?: string;
  
  // Location data
  latitude?: number;
  longitude?: number;
}

export interface UpdateCaseData {
  status?: CaseStatus;
  priority?: CasePriority;
  notes?: string;
  assignedToId?: string;
  verificationOutcome?: string;
  completedAt?: string;
  
  // Applicant updates
  applicantName?: string;
  applicantPhone?: string;
  applicantEmail?: string;
  
  // Address updates
  address?: string;
  pincode?: string;
  latitude?: number;
  longitude?: number;
}

export interface CaseAssignmentData {
  assignedToId: string;
  reason?: string;
  priority?: CasePriority;
}

export interface CaseBulkUpdateData {
  status?: CaseStatus;
  priority?: CasePriority;
  assignedToId?: string;
  reason?: string;
}

export interface CaseStatsResponse {
  total: number;
  byStatus: Record<CaseStatus, number>;
  byPriority: Record<string, number>;
  pendingDuration: {
    average: number;
    median: number;
    max: number;
  };
}

export interface CaseTimelineEvent {
  id: string;
  caseId: string;
  eventType: string;
  description: string;
  createdAt: string;
  createdBy: string;
  createdByName: string;
  metadata?: Record<string, any>;
}

export interface CaseAttachment {
  id: string;
  caseId: string;
  fileName: string;
  originalName: string;
  fileSize: number;
  mimeType: string;
  url: string;
  thumbnailUrl?: string;
  uploadedAt: string;
  uploadedBy: string;
  uploadedByName: string;
  category?: string;
  description?: string;
}

/**
 * Modern Cases Service Class
 */
export class CasesService extends BaseApiService {
  constructor() {
    super('/cases');
  }

  // ==================== CRUD Operations ====================

  /**
   * Get paginated list of cases with filters
   */
  async getCases(query: CaseListQuery = {}): Promise<PaginatedResponse<Case>> {
    return this.getPaginated('', query);
  }

  /**
   * Get case by ID
   */
  async getCaseById(id: string): Promise<ApiResponse<Case>> {
    return this.get(`/${id}`);
  }

  /**
   * Create new case (uses unified /create endpoint)
   */
  async createCase(data: CreateCaseData): Promise<ApiResponse<Case>> {
    // Transform old format to new unified format
    const unifiedPayload = {
      case_details: {
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        customerCallingCode: data.customerCallingCode,
        customerEmail: (data as any).customerEmail,
        clientId: data.clientId,
        productId: data.productId,
        backendContactNumber: data.backendContactNumber,
        priority: data.priority,
        pincode: data.pincode,
        deduplicationDecision: data.deduplicationDecision,
        deduplicationRationale: data.deduplicationRationale,
        panNumber: data.panNumber,
      },
      verification_tasks: [{
        verification_type_id: data.verificationTypeId ? parseInt(data.verificationTypeId) : 0,
        task_title: `${data.verificationType || 'Verification'} Task`,
        task_description: data.trigger,
        priority: data.priority,
        assigned_to: data.assignedToId || undefined,
        rate_type_id: data.rateTypeId,
        address: data.address,
        pincode: data.pincode,
        applicant_type: data.applicantType,
        trigger: data.trigger,
      }]
    };

    return this.post('/create', unifiedPayload);
  }

  /**
   * Create case with file attachments (uses unified /create endpoint)
   */
  async createCaseWithAttachments(
    data: CreateCaseData,
    attachments: File[]
  ): Promise<ApiResponse<Case>> {
    const formData = new FormData();

    // Transform to unified format
    const unifiedPayload = {
      case_details: {
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        customerCallingCode: data.customerCallingCode,
        customerEmail: (data as any).customerEmail,
        clientId: data.clientId,
        productId: data.productId,
        backendContactNumber: data.backendContactNumber,
        priority: data.priority,
        pincode: data.pincode,
        deduplicationDecision: data.deduplicationDecision,
        deduplicationRationale: data.deduplicationRationale,
        panNumber: data.panNumber,
      },
      verification_tasks: [{
        verification_type_id: data.verificationTypeId ? parseInt(data.verificationTypeId) : 0,
        task_title: `${data.verificationType || 'Verification'} Task`,
        task_description: data.trigger,
        priority: data.priority,
        assigned_to: data.assignedToId || undefined,
        rate_type_id: data.rateTypeId,
        address: data.address,
        pincode: data.pincode,
        applicant_type: data.applicantType,
        trigger: data.trigger,
      }]
    };

    // Add unified payload as JSON string
    formData.append('data', JSON.stringify(unifiedPayload));

    // Add attachments
    attachments.forEach((file, index) => {
      formData.append(`attachments`, file);
    });

    return this.post('/create', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  }

  /**
   * Update case
   */
  async updateCase(id: string, data: UpdateCaseData): Promise<ApiResponse<Case>> {
    return this.put(`/${id}`, data);
  }

  /**
   * Delete case
   */
  async deleteCase(id: string): Promise<ApiResponse<void>> {
    return this.delete(`/${id}`);
  }

  // ==================== Assignment Operations ====================

  /**
   * Assign case to user
   */
  async assignCase(id: string, data: CaseAssignmentData): Promise<ApiResponse<Case>> {
    return this.post(`/${id}/assign`, data);
  }

  /**
   * Bulk assign cases
   */
  async bulkAssignCases(
    caseIds: string[], 
    assignedToId: string, 
    reason?: string
  ): Promise<ApiResponse<BulkOperationResult>> {
    return this.bulkOperation('/bulk-assign', 'assign', caseIds, {
      assignedToId,
      reason
    });
  }

  /**
   * Unassign case
   */
  async unassignCase(id: string, reason?: string): Promise<ApiResponse<Case>> {
    return this.post(`/${id}/unassign`, { reason });
  }

  // ==================== Status Operations ====================

  /**
   * Update case status
   */
  async updateCaseStatus(
    id: string, 
    status: CaseStatus, 
    notes?: string
  ): Promise<ApiResponse<Case>> {
    return this.patch(`/${id}/status`, { status, notes });
  }

  /**
   * Bulk update case status
   */
  async bulkUpdateCaseStatus(
    caseIds: string[], 
    data: CaseBulkUpdateData
  ): Promise<ApiResponse<BulkOperationResult>> {
    return this.bulkOperation('/bulk-update', 'update-status', caseIds, data);
  }

  /**
   * Complete case
   */
  async completeCase(
    id: string, 
    outcome: string, 
    notes?: string
  ): Promise<ApiResponse<Case>> {
    return this.post(`/${id}/complete`, { outcome, notes });
  }

  // ==================== Analytics & Statistics ====================

  /**
   * Get case statistics
   */
  async getCaseStats(filters?: CaseFilters): Promise<ApiResponse<CaseStatsResponse>> {
    return this.get('/stats', filters);
  }

  /**
   * Get cases by status
   */
  async getCasesByStatus(status: CaseStatus): Promise<ApiResponse<Case[]>> {
    return this.get('/by-status', { status });
  }

  /**
   * Get cases assigned to user
   */
  async getUserCases(userId: string, query?: CaseListQuery): Promise<PaginatedResponse<Case>> {
    return this.getPaginated(`/user/${userId}`, query);
  }

  // ==================== Timeline & History ====================

  /**
   * Get case timeline events
   */
  async getCaseTimeline(id: string): Promise<ApiResponse<CaseTimelineEvent[]>> {
    return this.get(`/${id}/timeline`);
  }

  /**
   * Add timeline event
   */
  async addTimelineEvent(
    id: string, 
    eventType: string, 
    description: string, 
    metadata?: Record<string, any>
  ): Promise<ApiResponse<CaseTimelineEvent>> {
    return this.post(`/${id}/timeline`, {
      eventType,
      description,
      metadata
    });
  }

  // ==================== Attachments ====================

  /**
   * Get case attachments
   */
  async getCaseAttachments(id: string): Promise<ApiResponse<CaseAttachment[]>> {
    return this.get(`/${id}/attachments`);
  }

  /**
   * Upload case attachment
   */
  async uploadAttachment(
    id: string, 
    file: File, 
    category?: string, 
    description?: string
  ): Promise<ApiResponse<CaseAttachment>> {
    return this.uploadFile(`/${id}/attachments`, file, {
      category,
      description
    });
  }

  /**
   * Delete case attachment
   */
  async deleteAttachment(caseId: string, attachmentId: string): Promise<ApiResponse<void>> {
    return this.delete(`/${caseId}/attachments/${attachmentId}`);
  }

  // ==================== Export & Import ====================

  /**
   * Export cases
   */
  async exportCases(options: ExportOptions): Promise<Blob> {
    return this.exportData('/export', options.format, options.filters);
  }

  /**
   * Get export template
   */
  async getExportTemplate(format: 'excel' | 'csv'): Promise<Blob> {
    return this.exportData('/export-template', format);
  }

  // ==================== Search & Filters ====================

  /**
   * Search cases with advanced filters
   */
  async searchCases(query: string, filters?: CaseFilters): Promise<ApiResponse<Case[]>> {
    return this.get('/search', { query, ...filters });
  }

  /**
   * Get case filters metadata (for building filter UI)
   */
  async getFiltersMetadata(): Promise<ApiResponse<{
    statuses: CaseStatus[];
    priorities: CasePriority[];
    verificationTypes: Array<{ id: number; name: string }>;
    clients: Array<{ id: number; name: string }>;
    products: Array<{ id: number; name: string }>;
  }>> {
    return this.get('/filters-metadata');
  }
}

// Export singleton instance
export const casesService = new CasesService();
export default casesService;
