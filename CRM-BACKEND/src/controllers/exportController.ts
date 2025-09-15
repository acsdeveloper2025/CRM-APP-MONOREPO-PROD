import { Request, Response } from 'express';
import { PDFExportService } from '../services/PDFExportService';
import { ExcelExportService } from '../services/ExcelExportService';
import { CSVExportService } from '../services/CSVExportService';
import { EmailDeliveryService } from '../services/EmailDeliveryService';
import { logger } from '../utils/logger';
import { AuthenticatedRequest } from '../middleware/auth';
import path from 'path';
import fs from 'fs/promises';

export interface ExportRequest {
  format: 'pdf' | 'excel' | 'csv' | 'json';
  reportType: 'form-submissions' | 'agent-performance' | 'case-analytics' | 'validation-status';
  dateFrom?: string;
  dateTo?: string;
  filters?: Record<string, any>;
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

/**
 * Export Controller
 * Handles all data export requests with multiple format support
 */

// Generate and download/email reports
export const generateReport = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const exportRequest: ExportRequest = req.body;
    
    // Validate request
    const validation = validateExportRequest(exportRequest);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid export request',
        errors: validation.errors
      });
    }

    // Generate report based on format
    let result;
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
          message: `Unsupported export format: ${exportRequest.format}`
        });
    }

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to generate report',
        error: result.error
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
          await fs.unlink(result.filePath!);
        } catch (error) {
          logger.warn('Failed to clean up file after email delivery:', error);
        }

        return res.json({
          success: true,
          message: 'Report generated and emailed successfully',
          emailResult: {
            messageId: emailResult.messageId,
            recipients: exportRequest.delivery.recipients
          }
        });
      } else {
        return res.status(500).json({
          success: false,
          message: 'Report generated but email delivery failed',
          error: emailResult.error
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
          downloadUrl: `/api/exports/download/${path.basename(result.filePath!)}`,
          recordCount: result.recordCount
        }
      });
    }

  } catch (error) {
    logger.error('Error in generateReport:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during report generation',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};

// Download generated report file
export const downloadReport = async (req: Request, res: Response) => {
  try {
    const { fileName } = req.params;
    const filePath = path.join(process.cwd(), 'exports', fileName);

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch (error) {
      return res.status(404).json({
        success: false,
        message: 'Report file not found'
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
    const fileStream = require('fs').createReadStream(filePath);
    fileStream.pipe(res);

    // Clean up file after download (optional)
    fileStream.on('end', async () => {
      try {
        // Optionally delete file after download
        // await fs.unlink(filePath);
      } catch (error) {
        logger.warn('Failed to clean up downloaded file:', error);
      }
    });

  } catch (error) {
    logger.error('Error in downloadReport:', error);
    res.status(500).json({
      success: false,
      message: 'Error downloading report',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};

// Get export history
export const getExportHistory = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    const userId = req.user?.id;

    // This would typically come from a database table tracking exports
    // For now, return mock data
    const mockHistory = [
      {
        id: '1',
        fileName: 'form_submissions_report_2024-01-15T10-30-00.pdf',
        reportType: 'form-submissions',
        format: 'pdf',
        fileSize: 2457600,
        createdAt: '2024-01-15T10:30:00Z',
        createdBy: userId,
        status: 'completed',
        downloadCount: 3
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
        downloadCount: 1
      }
    ];

    res.json({
      success: true,
      data: {
        exports: mockHistory,
        pagination: {
          total: mockHistory.length,
          limit: parseInt(limit as string),
          offset: parseInt(offset as string)
        }
      }
    });

  } catch (error) {
    logger.error('Error in getExportHistory:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch export history',
      error: process.env.NODE_ENV === 'development' ? error : undefined
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
        message: 'Email configuration is working correctly'
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Email configuration test failed'
      });
    }

  } catch (error) {
    logger.error('Error testing email config:', error);
    res.status(500).json({
      success: false,
      message: 'Error testing email configuration',
      error: process.env.NODE_ENV === 'development' ? error : undefined
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
  } else if (!['form-submissions', 'agent-performance', 'case-analytics', 'validation-status'].includes(request.reportType)) {
    errors.push('Invalid report type');
  }

  if (request.dateFrom && request.dateTo) {
    const fromDate = new Date(request.dateFrom);
    const toDate = new Date(request.dateTo);
    if (fromDate > toDate) {
      errors.push('Date from cannot be after date to');
    }
  }

  if (request.delivery?.method === 'email' && (!request.delivery.recipients || request.delivery.recipients.length === 0)) {
    errors.push('Email recipients are required for email delivery');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

async function generatePDFReport(request: ExportRequest): Promise<any> {
  const pdfService = PDFExportService.getInstance();
  
  const options = {
    reportType: request.reportType,
    dateFrom: request.dateFrom,
    dateTo: request.dateTo,
    filters: request.filters,
    template: (request.options?.template as 'standard' | 'detailed' | 'summary') || 'standard',
    includeCharts: request.options?.includeCharts || false,
    orientation: request.options?.orientation || 'portrait'
  };

  return await pdfService.generatePDFReport(options);
}

async function generateExcelReport(request: ExportRequest): Promise<any> {
  const excelService = ExcelExportService.getInstance();
  
  const options = {
    reportType: request.reportType,
    dateFrom: request.dateFrom,
    dateTo: request.dateTo,
    filters: request.filters,
    includeCharts: request.options?.includeCharts || false,
    includeSummary: request.options?.includeSummary !== false
  };

  return await excelService.generateExcelReport(options);
}

async function generateCSVReport(request: ExportRequest): Promise<any> {
  const csvService = CSVExportService.getInstance();
  
  const options = {
    reportType: request.reportType,
    dateFrom: request.dateFrom,
    dateTo: request.dateTo,
    filters: request.filters,
    delimiter: request.options?.delimiter || ',',
    includeHeaders: true,
    encoding: request.options?.encoding || 'utf8'
  };

  return await csvService.generateCSVReport(options);
}

async function generateJSONReport(request: ExportRequest): Promise<any> {
  // For JSON, we'll use the CSV service to get the data and then format as JSON
  const csvService = CSVExportService.getInstance();
  
  try {
    // Get the raw data (we'll modify CSV service to return raw data for JSON)
    const data = await csvService.generateCSVReport({
      reportType: request.reportType,
      dateFrom: request.dateFrom,
      dateTo: request.dateTo,
      filters: request.filters,
      includeHeaders: false // We don't need headers for JSON
    });

    if (!data.success) {
      return data;
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
        to: request.dateTo
      },
      filters: request.filters,
      recordCount: data.recordCount,
      data: (data as any).data || []
    };

    // Write JSON file
    await fs.writeFile(filePath, JSON.stringify(jsonData, null, 2), 'utf8');

    const stats = await fs.stat(filePath);

    return {
      success: true,
      filePath,
      fileName,
      fileSize: stats.size,
      recordCount: data.recordCount
    };

  } catch (error) {
    logger.error('Error generating JSON report:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function deliverReportByEmail(
  reportResult: any,
  recipients: string[],
  reportType: string,
  customSubject?: string
): Promise<any> {
  const emailService = EmailDeliveryService.getInstance();
  
  return await emailService.sendReportEmail(
    recipients,
    reportType,
    reportResult.filePath,
    reportResult.reportData
  );
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
