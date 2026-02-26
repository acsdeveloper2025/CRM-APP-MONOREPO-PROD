import type { Request, Response } from 'express';
import { PDFExportService } from '../services/PDFExportService';
import { ExcelExportService } from '../services/ExcelExportService';
import { CSVExportService } from '../services/CSVExportService';
import { EmailDeliveryService } from '../services/EmailDeliveryService';
import { logger } from '../utils/logger';
import type { AuthenticatedRequest } from '../middleware/auth';
import path from 'path';
import fs from 'fs/promises';
import { createReadStream } from 'fs';
import { requireControllerPermission } from '@/security/controllerAuthorization';

export interface ExportRequest {
  format: 'pdf' | 'excel' | 'csv' | 'json';
  reportType: 'form-submissions' | 'agent-performance' | 'case-analytics' | 'validation-status';
  dateFrom?: string;
  dateTo?: string;
  filters?: Record<string, unknown>;
  options?: {
    includeCharts?: boolean;
    includeSummary?: boolean;
    template?: string;
    orientation?: 'portrait' | 'landscape';
    delimiter?: string;
    encoding?: 'utf8' | 'utf16le';
  };
  delivery?: {
    method: 'download' | 'email';
    recipients?: string[];
    subject?: string;
  };
}

interface ExportResult {
  success: boolean;
  filePath?: string;
  fileName?: string;
  fileSize?: number;
  recordCount?: number;
  error?: unknown;

  data?: (string | number | boolean)[]; // For JSON data
  messageId?: string; // For Email result

  reportData?: unknown; // For intermediate results to email
}

interface ExportHistoryItem {
  id: string;
  fileName: string;
  reportType: string;
  format: string;
  fileSize: number;
  createdAt: string;
  createdBy?: string;
  status: string;
  downloadCount: number;
}

/**
 * Export Controller
 * Handles all data export requests with multiple format support
 */

// Generate and download/email reports
export const generateReport = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!requireControllerPermission(req, res, 'report.generate')) {
      return;
    }
    const exportRequest: ExportRequest = req.body;

    // Validate request
    const validation = validateExportRequest(exportRequest);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid export request',
        errors: validation.errors,
      });
    }

    // Generate report based on format
    let result: ExportResult;
    switch (exportRequest.format) {
      case 'pdf':
        result = await generatePDFReport(exportRequest);
        break;
      case 'excel':
        result = await generateExcelReport(exportRequest);
        break;
      case 'csv':
        result = await generateCSVReport(exportRequest);
        break;
      case 'json':
        result = await generateJSONReport(exportRequest);
        break;
      default:
        return res.status(400).json({
          success: false,
          message: `Unsupported export format`,
        });
    }

    if (!result.success || !result.filePath) {
      return res.status(500).json({
        success: false,
        message: 'Failed to generate report',
        error: result.error,
      });
    }

    // Handle delivery method
    if (exportRequest.delivery?.method === 'email' && exportRequest.delivery.recipients) {
      const emailResult = await deliverReportByEmail(
        result,
        exportRequest.delivery.recipients,
        exportRequest.reportType,
        exportRequest.delivery.subject
      );

      if (emailResult.success) {
        // Clean up file after email
        try {
          await fs.unlink(result.filePath);
        } catch (error) {
          logger.warn('Failed to clean up file after email delivery:', error);
        }

        return res.json({
          success: true,
          message: 'Report generated and emailed successfully',
          emailResult: {
            messageId: emailResult.messageId,
            recipients: exportRequest.delivery.recipients,
          },
        });
      } else {
        return res.status(500).json({
          success: false,
          message: 'Report generated but email delivery failed',
          error: emailResult.error,
        });
      }
    } else {
      // Return download information
      return res.json({
        success: true,
        message: 'Report generated successfully',
        data: {
          fileName: result.fileName,
          fileSize: result.fileSize,
          downloadUrl: `/api/exports/download/${path.basename(result.filePath)}`,
          recordCount: result.recordCount,
        },
      });
    }
  } catch (error) {
    logger.error('Error in generateReport:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during report generation',
      error: process.env.NODE_ENV === 'development' ? error : undefined,
    });
  }
};

// Download generated report file
export const downloadReport = async (req: Request, res: Response) => {
  try {
    if (!requireControllerPermission(req as AuthenticatedRequest, res, 'report.download')) {
      return;
    }
    const fileName = String(req.params.fileName || '');
    const filePath = path.join(process.cwd(), 'exports', fileName);

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch (_error) {
      return res.status(404).json({
        success: false,
        message: 'Report file not found',
      });
    }

    // Get file stats
    const stats = await fs.stat(filePath);

    // Set appropriate headers
    const contentType = getContentType(fileName);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', stats.size);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    // Stream file to response
    const fileStream = createReadStream(filePath);
    fileStream.pipe(res);

    // Clean up file after download (optional)
    fileStream.on('end', () => {
      // try {
      //   // Optionally delete file after download
      //   // await fs.unlink(filePath);
      // } catch (error) {
      //   logger.warn('Failed to clean up downloaded file:', error);
      // }
    });
  } catch (error) {
    logger.error('Error in downloadReport:', error);
    res.status(500).json({
      success: false,
      message: 'Error downloading report',
      error: process.env.NODE_ENV === 'development' ? error : undefined,
    });
  }
};

// Get export history
export const getExportHistory = (req: AuthenticatedRequest, res: Response) => {
  try {
    const limit = Number(req.query.limit) || 50;
    const offset = Number(req.query.offset) || 0;
    const userId = req.user?.id;

    // TODO: Connect to real export_history table
    // For now, return strictly typed mock data
    const mockHistory: ExportHistoryItem[] = [
      {
        id: '1',
        fileName: 'form_submissions_report_2024-01-15T10-30-00.pdf',
        reportType: 'form-submissions',
        format: 'pdf',
        fileSize: 2457600,
        createdAt: '2024-01-15T10:30:00Z',
        createdBy: userId,
        status: 'completed',
        downloadCount: 3,
      },
      {
        id: '2',
        fileName: 'agent_performance_report_2024-01-14T15-45-00.xlsx',
        reportType: 'agent-performance',
        format: 'excel',
        fileSize: 1843200,
        createdAt: '2024-01-14T15:45:00Z',
        createdBy: userId,
        status: 'completed',
        downloadCount: 1,
      },
    ];

    res.json({
      success: true,
      data: {
        exports: mockHistory,
        pagination: {
          total: mockHistory.length,
          limit,
          offset,
        },
      },
    });
  } catch (error) {
    logger.error('Error in getExportHistory:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch export history',
      error: process.env.NODE_ENV === 'development' ? error : undefined,
    });
  }
};

// Test email configuration
export const testEmailConfig = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const emailService = EmailDeliveryService.getInstance();
    const isConnected = await emailService.testConnection();

    if (isConnected) {
      res.json({
        success: true,
        message: 'Email configuration is working correctly',
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Email configuration test failed',
      });
    }
  } catch (error) {
    logger.error('Error testing email config:', error);
    res.status(500).json({
      success: false,
      message: 'Error testing email configuration',
      error: process.env.NODE_ENV === 'development' ? error : undefined,
    });
  }
};

// Helper functions

function validateExportRequest(request: ExportRequest): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!request.format) {
    errors.push('Export format is required');
  } else if (!['pdf', 'excel', 'csv', 'json'].includes(request.format)) {
    errors.push('Invalid export format');
  }

  if (!request.reportType) {
    errors.push('Report type is required');
  } else if (
    !['form-submissions', 'agent-performance', 'case-analytics', 'validation-status'].includes(
      request.reportType
    )
  ) {
    errors.push('Invalid report type');
  }

  if (request.dateFrom && request.dateTo) {
    const fromDate = new Date(request.dateFrom);
    const toDate = new Date(request.dateTo);
    if (fromDate > toDate) {
      errors.push('Date from cannot be after date to');
    }
  }

  if (
    request.delivery?.method === 'email' &&
    (!request.delivery.recipients || request.delivery.recipients.length === 0)
  ) {
    errors.push('Email recipients are required for email delivery');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

async function generatePDFReport(request: ExportRequest): Promise<ExportResult> {
  const pdfService = PDFExportService.getInstance();

  const options = {
    reportType: request.reportType,
    dateFrom: request.dateFrom,
    dateTo: request.dateTo,
    filters: request.filters,
    template: (request.options?.template as 'standard' | 'detailed' | 'summary') || 'standard',
    includeCharts: request.options?.includeCharts || false,
    orientation: request.options?.orientation || 'portrait',
  };

  const result = await pdfService.generatePDFReport(options);
  // Assume result matches ExportResult or map it
  // Since we don't have visibility into PDFExportService types right here, we strictly type what we can
  return result as unknown as ExportResult;
}

async function generateExcelReport(request: ExportRequest): Promise<ExportResult> {
  const excelService = ExcelExportService.getInstance();

  const options = {
    reportType: request.reportType,
    dateFrom: request.dateFrom,
    dateTo: request.dateTo,
    filters: request.filters,
    includeCharts: request.options?.includeCharts || false,
    includeSummary: request.options?.includeSummary !== false,
  };

  const result = await excelService.generateExcelReport(options);
  return result as unknown as ExportResult;
}

async function generateCSVReport(request: ExportRequest): Promise<ExportResult> {
  const csvService = CSVExportService.getInstance();

  const options = {
    reportType: request.reportType,
    dateFrom: request.dateFrom,
    dateTo: request.dateTo,
    filters: request.filters,
    delimiter: request.options?.delimiter || ',',
    includeHeaders: true,
    encoding: request.options?.encoding || 'utf8',
  };

  const result = await csvService.generateCSVReport(options);
  return result as unknown as ExportResult;
}

async function generateJSONReport(request: ExportRequest): Promise<ExportResult> {
  // For JSON, we'll use the CSV service to get the data and then format as JSON
  const csvService = CSVExportService.getInstance();

  try {
    // Get the raw data containing the 'data' array
    const result = await csvService.generateCSVReport({
      reportType: request.reportType,
      dateFrom: request.dateFrom,
      dateTo: request.dateTo,
      filters: request.filters,
      includeHeaders: false, // We don't need headers for JSON
    });

    const typedResult = result as unknown as {
      success: boolean;
      data: Record<string, unknown>[];
      recordCount: number;
    };

    if (!typedResult.success) {
      return result as unknown as ExportResult;
    }

    // Convert to JSON and save
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const fileName = `${request.reportType.replace(/-/g, '_')}_report_${timestamp}.json`;
    const filePath = path.join(process.cwd(), 'exports', fileName);

    // Ensure exports directory exists
    await fs.mkdir(path.dirname(filePath), { recursive: true });

    // Create JSON structure
    const jsonData = {
      reportType: request.reportType,
      generatedAt: new Date().toISOString(),
      dateRange: {
        from: request.dateFrom,
        to: request.dateTo,
      },
      filters: request.filters,
      recordCount: typedResult.recordCount,
      data: typedResult.data || [],
    };

    // Write JSON file
    await fs.writeFile(filePath, JSON.stringify(jsonData, null, 2), 'utf8');

    const stats = await fs.stat(filePath);

    return {
      success: true,
      filePath,
      fileName,
      fileSize: stats.size,
      recordCount: typedResult.recordCount,
    };
  } catch (error) {
    logger.error('Error generating JSON report:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function deliverReportByEmail(
  reportResult: ExportResult,
  recipients: string[],
  reportType: string,
  _customSubject?: string
): Promise<ExportResult> {
  const emailService = EmailDeliveryService.getInstance();

  // Added await to satisfy require-await rule and ensure correct error propagation
  const result = await emailService.sendReportEmail(
    recipients,
    reportType,
    reportResult.filePath,
    // Safely access data if it exists
    (reportResult.reportData || {}) as Record<string, unknown>
  );

  return result as unknown as ExportResult;
}

function getContentType(fileName: string): string {
  const extension = path.extname(fileName).toLowerCase();

  switch (extension) {
    case '.pdf':
      return 'application/pdf';
    case '.xlsx':
    case '.xls':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case '.csv':
      return 'text/csv';
    case '.json':
      return 'application/json';
    default:
      return 'application/octet-stream';
  }
}
