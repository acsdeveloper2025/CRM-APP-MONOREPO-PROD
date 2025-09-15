import { apiService } from './api';
import type { ApiResponse } from '@/types/api';

export interface DeduplicationCriteria {
  customerName?: string;
  panNumber?: string;
  customerPhone?: string;
}

export interface DuplicateCase {
  id: string;
  caseId: number;
  customerName: string;
  customerPhone?: string;
  panNumber?: string;
  status: string;
  createdAt: string;
  clientName?: string;
  matchType: string[];
  matchScore: number;
}

export interface DeduplicationResult {
  duplicatesFound: DuplicateCase[];
  searchCriteria: DeduplicationCriteria;
  totalMatches: number;
}

export interface DeduplicationDecision {
  caseId: string;
  decision: 'CREATE_NEW' | 'USE_EXISTING' | 'MERGE_CASES';
  rationale: string;
  selectedExistingCaseId?: string;
}

export interface DuplicateCluster {
  group_key: string;
  case_count: number;
  cases: Array<{
    id: string;
    caseNumber: string;
    applicantName: string;
    status: string;
    createdAt: string;
    panNumber?: string;
    aadhaarNumber?: string;
    applicantPhone?: string;
    bankAccountNumber?: string;
  }>;
}

export class DeduplicationService {
  /**
   * Search for potential duplicate cases
   */
  async searchDuplicates(criteria: DeduplicationCriteria): Promise<ApiResponse<DeduplicationResult>> {
    return apiService.post('/cases/deduplication/search', criteria);
  }

  /**
   * Record deduplication decision
   */
  async recordDeduplicationDecision(
    decision: DeduplicationDecision,
    duplicatesFound: DuplicateCase[],
    searchCriteria: DeduplicationCriteria
  ): Promise<ApiResponse<void>> {
    return apiService.post('/cases/deduplication/decision', {
      decision,
      duplicatesFound,
      searchCriteria
    });
  }

  /**
   * Get deduplication history for a case
   */
  async getDeduplicationHistory(caseId: string): Promise<ApiResponse<any[]>> {
    return apiService.get(`/cases/${caseId}/deduplication/history`);
  }

  /**
   * Get duplicate case clusters for admin review
   */
  async getDuplicateClusters(page = 1, limit = 20): Promise<ApiResponse<{
    clusters: DuplicateCluster[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }>> {
    return apiService.get('/cases/deduplication/clusters', { page, limit });
  }

  /**
   * Validate deduplication criteria before search
   */
  validateCriteria(criteria: DeduplicationCriteria): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check if at least one criterion is provided
    const hasValidCriteria = Object.values(criteria).some(value => 
      value && typeof value === 'string' && value.trim().length > 0
    );

    if (!hasValidCriteria) {
      errors.push('At least one search criterion must be provided');
    }

    // Validate PAN format
    if (criteria.panNumber && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(criteria.panNumber)) {
      errors.push('Invalid PAN number format (should be ABCDE1234F)');
    }

    // Validate Aadhaar format
    if (criteria.aadhaarNumber) {
      const aadhaar = criteria.aadhaarNumber.replace(/\s/g, '');
      if (!/^[0-9]{12}$/.test(aadhaar)) {
        errors.push('Invalid Aadhaar number format (should be 12 digits)');
      }
    }

    // Validate phone format
    if (criteria.customerPhone) {
      const phone = criteria.customerPhone.replace(/\D/g, '');
      if (phone.length < 10) {
        errors.push('Phone number should be at least 10 digits');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Clean and format criteria for search
   */
  cleanCriteria(criteria: DeduplicationCriteria): DeduplicationCriteria {
    const cleaned: DeduplicationCriteria = {};

    if (criteria.customerName?.trim()) {
      cleaned.customerName = criteria.customerName.trim();
    }

    if (criteria.panNumber?.trim()) {
      cleaned.panNumber = criteria.panNumber.trim().toUpperCase();
    }

    if (criteria.customerPhone?.trim()) {
      cleaned.customerPhone = criteria.customerPhone.trim().replace(/\D/g, '');
    }

    if (criteria.applicantEmail?.trim()) {
      cleaned.applicantEmail = criteria.applicantEmail.trim().toLowerCase();
    }

    if (criteria.bankAccountNumber?.trim()) {
      cleaned.bankAccountNumber = criteria.bankAccountNumber.trim().replace(/\s/g, '');
    }

    return cleaned;
  }
}

export const deduplicationService = new DeduplicationService();
