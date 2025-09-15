import { apiService } from './api';
import type { ApiResponse } from '@/types/api';

export interface AIReport {
  id: string;
  executiveSummary: string;
  keyFindings: string[];
  verificationDetails: string;
  riskAssessment: string;
  recommendations: string[];
  conclusion: string;
  confidence: number;
  templateInsights?: {
    verificationType: string;
    statusCategory: string;
    keyFields: string[];
    riskAssessment: {
      level: 'LOW' | 'MEDIUM' | 'HIGH';
      factors: string[];
      mitigation: string[];
    };
    recommendations: string[];
  };
  metadata?: {
    generatedAt: string;
    generatedBy: string;
    caseId: string;
    submissionId: string;
    verificationType: string;
    outcome: string;
  };
}

export interface AIReportResponse {
  report: AIReport;
  reportId: string;
}

export interface AIReportData {
  id: string;
  report: AIReport;
  generatedAt: string;
  generatedBy: string;
}

class AIReportsService {
  /**
   * Generate AI-powered verification report for a form submission
   */
  async generateFormSubmissionReport(caseId: string, submissionId: string): Promise<ApiResponse<AIReportResponse>> {
    return apiService.post(`/ai-reports/cases/${caseId}/submissions/${submissionId}/generate`);
  }

  /**
   * Get existing AI report for a form submission
   */
  async getFormSubmissionReport(caseId: string, submissionId: string): Promise<ApiResponse<AIReportData>> {
    return apiService.get(`/ai-reports/cases/${caseId}/submissions/${submissionId}`);
  }

  /**
   * Test Gemini AI connection
   */
  async testAIConnection(): Promise<ApiResponse<{ success: boolean; error?: string }>> {
    return apiService.get('/ai-reports/test-connection');
  }

  /**
   * Download AI report as PDF (placeholder for future implementation)
   */
  async downloadReport(caseId: string, submissionId: string, format: 'PDF' | 'DOCX' = 'PDF'): Promise<Blob> {
    // TODO: Implement download functionality
    throw new Error('Download functionality not yet implemented');
  }

  /**
   * Get AI report statistics for dashboard
   */
  async getReportStatistics(filters?: {
    dateFrom?: string;
    dateTo?: string;
    verificationType?: string;
  }): Promise<ApiResponse<{
    totalReports: number;
    averageConfidence: number;
    riskDistribution: {
      low: number;
      medium: number;
      high: number;
    };
    verificationTypeBreakdown: Array<{
      type: string;
      count: number;
      averageConfidence: number;
    }>;
  }>> {
    return apiService.get('/ai-reports/statistics', filters);
  }

  /**
   * Bulk generate reports for multiple submissions
   */
  async bulkGenerateReports(requests: Array<{
    caseId: string;
    submissionId: string;
  }>): Promise<ApiResponse<{
    successful: number;
    failed: number;
    results: Array<{
      caseId: string;
      submissionId: string;
      success: boolean;
      reportId?: string;
      error?: string;
    }>;
  }>> {
    return apiService.post('/ai-reports/bulk-generate', { requests });
  }

  /**
   * Get AI report history for a case
   */
  async getCaseReportHistory(caseId: string): Promise<ApiResponse<Array<{
    id: string;
    submissionId: string;
    generatedAt: string;
    generatedBy: string;
    confidence: number;
    verificationType: string;
    outcome: string;
  }>>> {
    return apiService.get(`/ai-reports/cases/${caseId}/history`);
  }

  /**
   * Update AI report (for manual corrections or additions)
   */
  async updateReport(reportId: string, updates: Partial<AIReport>): Promise<ApiResponse<AIReport>> {
    return apiService.patch(`/ai-reports/${reportId}`, updates);
  }

  /**
   * Delete AI report
   */
  async deleteReport(reportId: string): Promise<ApiResponse<void>> {
    return apiService.delete(`/ai-reports/${reportId}`);
  }

  /**
   * Get AI model performance metrics
   */
  async getModelPerformance(): Promise<ApiResponse<{
    totalReports: number;
    averageConfidence: number;
    accuracyMetrics: {
      highConfidenceAccuracy: number;
      mediumConfidenceAccuracy: number;
      lowConfidenceAccuracy: number;
    };
    processingTime: {
      average: number;
      median: number;
      p95: number;
    };
    errorRate: number;
    lastUpdated: string;
  }>> {
    return apiService.get('/ai-reports/model-performance');
  }

  /**
   * Provide feedback on AI report quality
   */
  async submitReportFeedback(reportId: string, feedback: {
    accuracy: 1 | 2 | 3 | 4 | 5;
    usefulness: 1 | 2 | 3 | 4 | 5;
    completeness: 1 | 2 | 3 | 4 | 5;
    comments?: string;
  }): Promise<ApiResponse<void>> {
    return apiService.post(`/ai-reports/${reportId}/feedback`, feedback);
  }

  /**
   * Get AI report templates and configurations
   */
  async getReportTemplates(): Promise<ApiResponse<{
    verificationTypes: Array<{
      type: string;
      name: string;
      description: string;
      primaryFields: string[];
      riskIndicators: string[];
      successCriteria: string[];
    }>;
    statusCategories: Array<{
      category: string;
      name: string;
      description: string;
      riskLevel: string;
      confidence: number;
      keyPoints: string[];
    }>;
  }>> {
    return apiService.get('/ai-reports/templates');
  }

  /**
   * Validate AI service configuration
   */
  async validateConfiguration(): Promise<ApiResponse<{
    geminiApiConfigured: boolean;
    modelAvailable: boolean;
    quotaRemaining?: number;
    lastSuccessfulCall?: string;
    errors?: string[];
  }>> {
    return apiService.get('/ai-reports/validate-config');
  }
}

export const aiReportsService = new AIReportsService();
