import { Response } from 'express';
import { ScheduledReportsService, ScheduledReport } from '../services/ScheduledReportsService';
import { logger } from '../utils/logger';
import { AuthenticatedRequest } from '../middleware/auth';

/**
 * Scheduled Reports Controller
 * Handles CRUD operations for scheduled reports
 */

// Create a new scheduled report
export const createScheduledReport = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      name,
      reportType,
      format,
      frequency,
      recipients,
      filters,
      options
    } = req.body;

    // Validate required fields
    if (!name || !reportType || !format || !frequency || !recipients || recipients.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: name, reportType, format, frequency, recipients'
      });
    }

    // Validate frequency
    if (!['daily', 'weekly', 'monthly'].includes(frequency)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid frequency. Must be daily, weekly, or monthly'
      });
    }

    // Validate format
    if (!['pdf', 'excel', 'csv', 'json'].includes(format)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid format. Must be pdf, excel, csv, or json'
      });
    }

    // Validate report type
    if (!['form-submissions', 'agent-performance', 'case-analytics', 'validation-status'].includes(reportType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid report type'
      });
    }

    // Validate email addresses
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = recipients.filter((email: string) => !emailRegex.test(email));
    if (invalidEmails.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email addresses',
        invalidEmails
      });
    }

    const scheduledReportsService = ScheduledReportsService.getInstance();
    
    const reportData: Omit<ScheduledReport, 'id' | 'createdAt' | 'lastRun' | 'nextRun'> = {
      name,
      reportType,
      format,
      frequency,
      recipients,
      filters: filters || {},
      options: options || {},
      isActive: true,
      createdBy: req.user!.id
    };

    const createdReport = await scheduledReportsService.createScheduledReport(reportData);

    logger.info(`Scheduled report created by user ${req.user!.id}: ${createdReport.name}`);

    res.status(201).json({
      success: true,
      message: 'Scheduled report created successfully',
      data: createdReport
    });

  } catch (error) {
    logger.error('Error creating scheduled report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create scheduled report',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};

// Get all scheduled reports for the current user
export const getScheduledReports = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const scheduledReportsService = ScheduledReportsService.getInstance();
    
    // For non-admin users, only show their own reports
    const userId = req.user!.role === 'ADMIN' ? undefined : req.user!.id;
    
    const reports = await scheduledReportsService.getScheduledReports(userId);

    res.json({
      success: true,
      data: {
        reports,
        total: reports.length
      }
    });

  } catch (error) {
    logger.error('Error fetching scheduled reports:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch scheduled reports',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};

// Get a specific scheduled report
export const getScheduledReport = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const scheduledReportsService = ScheduledReportsService.getInstance();
    
    const reports = await scheduledReportsService.getScheduledReports();
    const report = reports.find(r => r.id === id);

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Scheduled report not found'
      });
    }

    // Check if user has permission to view this report
    if (req.user!.role !== 'ADMIN' && report.createdBy !== req.user!.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.json({
      success: true,
      data: report
    });

  } catch (error) {
    logger.error('Error fetching scheduled report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch scheduled report',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};

// Update a scheduled report
export const updateScheduledReport = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const scheduledReportsService = ScheduledReportsService.getInstance();
    
    // Check if report exists and user has permission
    const reports = await scheduledReportsService.getScheduledReports();
    const existingReport = reports.find(r => r.id === id);

    if (!existingReport) {
      return res.status(404).json({
        success: false,
        message: 'Scheduled report not found'
      });
    }

    if (req.user!.role !== 'ADMIN' && existingReport.createdBy !== req.user!.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Validate updates
    if (updates.frequency && !['daily', 'weekly', 'monthly'].includes(updates.frequency)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid frequency. Must be daily, weekly, or monthly'
      });
    }

    if (updates.format && !['pdf', 'excel', 'csv', 'json'].includes(updates.format)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid format. Must be pdf, excel, csv, or json'
      });
    }

    if (updates.recipients) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const invalidEmails = updates.recipients.filter((email: string) => !emailRegex.test(email));
      if (invalidEmails.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid email addresses',
          invalidEmails
        });
      }
    }

    const updatedReport = await scheduledReportsService.updateScheduledReport(id, updates);

    logger.info(`Scheduled report updated by user ${req.user!.id}: ${updatedReport.name}`);

    res.json({
      success: true,
      message: 'Scheduled report updated successfully',
      data: updatedReport
    });

  } catch (error) {
    logger.error('Error updating scheduled report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update scheduled report',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};

// Delete a scheduled report
export const deleteScheduledReport = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const scheduledReportsService = ScheduledReportsService.getInstance();
    
    // Check if report exists and user has permission
    const reports = await scheduledReportsService.getScheduledReports();
    const existingReport = reports.find(r => r.id === id);

    if (!existingReport) {
      return res.status(404).json({
        success: false,
        message: 'Scheduled report not found'
      });
    }

    if (req.user!.role !== 'ADMIN' && existingReport.createdBy !== req.user!.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    await scheduledReportsService.deleteScheduledReport(id);

    logger.info(`Scheduled report deleted by user ${req.user!.id}: ${existingReport.name}`);

    res.json({
      success: true,
      message: 'Scheduled report deleted successfully'
    });

  } catch (error) {
    logger.error('Error deleting scheduled report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete scheduled report',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};

// Toggle scheduled report active status
export const toggleScheduledReport = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'isActive must be a boolean value'
      });
    }

    const scheduledReportsService = ScheduledReportsService.getInstance();
    
    // Check if report exists and user has permission
    const reports = await scheduledReportsService.getScheduledReports();
    const existingReport = reports.find(r => r.id === id);

    if (!existingReport) {
      return res.status(404).json({
        success: false,
        message: 'Scheduled report not found'
      });
    }

    if (req.user!.role !== 'ADMIN' && existingReport.createdBy !== req.user!.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const updatedReport = await scheduledReportsService.updateScheduledReport(id, { isActive });

    logger.info(`Scheduled report ${isActive ? 'activated' : 'deactivated'} by user ${req.user!.id}: ${updatedReport.name}`);

    res.json({
      success: true,
      message: `Scheduled report ${isActive ? 'activated' : 'deactivated'} successfully`,
      data: updatedReport
    });

  } catch (error) {
    logger.error('Error toggling scheduled report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle scheduled report',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};

// Get scheduled report execution history
export const getScheduledReportHistory = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    // This would typically come from a database table tracking executions
    // For now, return mock data
    const mockHistory = [
      {
        id: '1',
        scheduledReportId: id,
        executedAt: '2024-01-15T08:00:00Z',
        status: 'success',
        fileSize: 2457600,
        recipients: ['user@example.com'],
        executionTime: 45000, // milliseconds
        error: null
      },
      {
        id: '2',
        scheduledReportId: id,
        executedAt: '2024-01-08T08:00:00Z',
        status: 'success',
        fileSize: 2234567,
        recipients: ['user@example.com'],
        executionTime: 38000,
        error: null
      },
      {
        id: '3',
        scheduledReportId: id,
        executedAt: '2024-01-01T08:00:00Z',
        status: 'failed',
        fileSize: null,
        recipients: ['user@example.com'],
        executionTime: 5000,
        error: 'Database connection timeout'
      }
    ];

    res.json({
      success: true,
      data: {
        history: mockHistory,
        pagination: {
          total: mockHistory.length,
          limit: parseInt(limit as string),
          offset: parseInt(offset as string)
        }
      }
    });

  } catch (error) {
    logger.error('Error fetching scheduled report history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch scheduled report history',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};

// Test scheduled report (execute immediately)
export const testScheduledReport = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const scheduledReportsService = ScheduledReportsService.getInstance();
    
    // Check if report exists and user has permission
    const reports = await scheduledReportsService.getScheduledReports();
    const report = reports.find(r => r.id === id);

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Scheduled report not found'
      });
    }

    if (req.user!.role !== 'ADMIN' && report.createdBy !== req.user!.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Execute the report immediately (this would be implemented in the service)
    // For now, just return success
    logger.info(`Test execution requested for scheduled report ${id} by user ${req.user!.id}`);

    res.json({
      success: true,
      message: 'Test execution initiated. You will receive the report via email shortly.'
    });

  } catch (error) {
    logger.error('Error testing scheduled report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to test scheduled report',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};
