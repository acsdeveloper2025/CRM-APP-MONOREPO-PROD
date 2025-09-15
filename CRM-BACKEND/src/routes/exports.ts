import express from 'express';
import { authenticateToken, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { Role } from '../types/auth';
import {
  generateReport,
  downloadReport,
  getExportHistory,
  testEmailConfig
} from '../controllers/exportController';
import {
  createScheduledReport,
  getScheduledReports,
  getScheduledReport,
  updateScheduledReport,
  deleteScheduledReport,
  toggleScheduledReport,
  getScheduledReportHistory,
  testScheduledReport
} from '../controllers/scheduledReportsController';

const router = express.Router();

/**
 * Export Routes
 * Phase 4: Data Export & Reporting Backend Services
 */

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * POST /api/exports/generate
 * Generate a new report in specified format
 * 
 * Body:
 * {
 *   "format": "pdf" | "excel" | "csv" | "json",
 *   "reportType": "form-submissions" | "agent-performance" | "case-analytics" | "validation-status",
 *   "dateFrom": "2024-01-01",
 *   "dateTo": "2024-01-31",
 *   "filters": { "formType": "RESIDENCE", "agentId": "uuid" },
 *   "options": {
 *     "includeCharts": true,
 *     "includeSummary": true,
 *     "template": "standard",
 *     "orientation": "portrait",
 *     "delimiter": ",",
 *     "encoding": "utf8"
 *   },
 *   "delivery": {
 *     "method": "download" | "email",
 *     "recipients": ["user@example.com"],
 *     "subject": "Custom Subject"
 *   }
 * }
 */
router.post('/generate',
  requireRole([Role.ADMIN, Role.BACKEND_USER, Role.MANAGER]),
  generateReport
);

/**
 * GET /api/exports/download/:fileName
 * Download a generated report file
 */
router.get('/download/:fileName',
  requireRole([Role.ADMIN, Role.BACKEND_USER, Role.MANAGER, Role.FIELD_AGENT]),
  downloadReport
);

/**
 * GET /api/exports/history
 * Get export history for the current user
 * 
 * Query params:
 * - limit: number (default: 50)
 * - offset: number (default: 0)
 * - reportType: string (optional filter)
 * - format: string (optional filter)
 */
router.get('/history',
  requireRole([Role.ADMIN, Role.BACKEND_USER, Role.MANAGER, Role.FIELD_AGENT]),
  getExportHistory
);

/**
 * POST /api/exports/test-email
 * Test email configuration
 */
router.post('/test-email',
  requireRole([Role.ADMIN, Role.BACKEND_USER]),
  testEmailConfig
);

/**
 * POST /api/exports/quick/form-submissions
 * Quick export for form submissions (CSV format)
 */
router.post('/quick/form-submissions',
  requireRole([Role.ADMIN, Role.BACKEND_USER, Role.MANAGER]),
  async (req: AuthenticatedRequest, res, next) => {
    req.body = {
      format: 'csv',
      reportType: 'form-submissions',
      dateFrom: req.body.dateFrom,
      dateTo: req.body.dateTo,
      filters: req.body.filters,
      delivery: { method: 'download' }
    };
    next();
  },
  generateReport
);

/**
 * POST /api/exports/quick/agent-performance
 * Quick export for agent performance (Excel format)
 */
router.post('/quick/agent-performance',
  requireRole([Role.ADMIN, Role.BACKEND_USER, Role.MANAGER]),
  async (req: AuthenticatedRequest, res, next) => {
    req.body = {
      format: 'excel',
      reportType: 'agent-performance',
      dateFrom: req.body.dateFrom,
      dateTo: req.body.dateTo,
      filters: req.body.filters,
      options: { includeSummary: true, includeCharts: false },
      delivery: { method: 'download' }
    };
    next();
  },
  generateReport
);

/**
 * POST /api/exports/quick/case-analytics
 * Quick export for case analytics (PDF format)
 */
router.post('/quick/case-analytics',
  requireRole([Role.ADMIN, Role.BACKEND_USER, Role.MANAGER]),
  async (req: AuthenticatedRequest, res, next) => {
    req.body = {
      format: 'pdf',
      reportType: 'case-analytics',
      dateFrom: req.body.dateFrom,
      dateTo: req.body.dateTo,
      filters: req.body.filters,
      options: { template: 'standard', orientation: 'landscape' },
      delivery: { method: 'download' }
    };
    next();
  },
  generateReport
);

/**
 * POST /api/exports/email/weekly-summary
 * Send weekly summary report via email
 */
router.post('/email/weekly-summary',
  requireRole([Role.ADMIN, Role.BACKEND_USER, Role.MANAGER]),
  async (req: AuthenticatedRequest, res, next) => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    req.body = {
      format: 'pdf',
      reportType: 'form-submissions',
      dateFrom: weekAgo.toISOString().split('T')[0],
      dateTo: new Date().toISOString().split('T')[0],
      options: { template: 'summary', includeCharts: true },
      delivery: {
        method: 'email',
        recipients: req.body.recipients,
        subject: 'Weekly CRM Analytics Summary'
      }
    };
    next();
  },
  generateReport
);

/**
 * POST /api/exports/email/monthly-performance
 * Send monthly performance report via email
 */
router.post('/email/monthly-performance',
  requireRole([Role.ADMIN, Role.BACKEND_USER, Role.MANAGER]),
  async (req: AuthenticatedRequest, res, next) => {
    const monthAgo = new Date();
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    
    req.body = {
      format: 'excel',
      reportType: 'agent-performance',
      dateFrom: monthAgo.toISOString().split('T')[0],
      dateTo: new Date().toISOString().split('T')[0],
      options: { includeSummary: true, includeCharts: false },
      delivery: {
        method: 'email',
        recipients: req.body.recipients,
        subject: 'Monthly Agent Performance Report'
      }
    };
    next();
  },
  generateReport
);

/**
 * GET /api/exports/templates
 * Get available export templates
 */
router.get('/templates',
  requireRole([Role.ADMIN, Role.BACKEND_USER, Role.MANAGER]),
  async (req: AuthenticatedRequest, res) => {
    try {
      const templates = {
        pdf: [
          {
            id: 'standard',
            name: 'Standard Report',
            description: 'Basic report with data tables and summary',
            features: ['Data tables', 'Summary statistics', 'Basic formatting']
          },
          {
            id: 'detailed',
            name: 'Detailed Report',
            description: 'Comprehensive report with charts and analysis',
            features: ['Data tables', 'Charts', 'Detailed analysis', 'Recommendations']
          },
          {
            id: 'summary',
            name: 'Executive Summary',
            description: 'High-level overview for management',
            features: ['Key metrics', 'Trends', 'Executive insights']
          }
        ],
        excel: [
          {
            id: 'standard',
            name: 'Standard Workbook',
            description: 'Multiple worksheets with data and summaries',
            features: ['Multiple sheets', 'Data tables', 'Summary sheet', 'Formatting']
          },
          {
            id: 'pivot',
            name: 'Pivot Table Report',
            description: 'Interactive pivot tables for analysis',
            features: ['Pivot tables', 'Charts', 'Interactive filters']
          }
        ],
        csv: [
          {
            id: 'standard',
            name: 'Standard CSV',
            description: 'Simple comma-separated values file',
            features: ['Raw data', 'Headers', 'UTF-8 encoding']
          },
          {
            id: 'excel-compatible',
            name: 'Excel Compatible',
            description: 'CSV optimized for Excel import',
            features: ['Excel formatting', 'Date formatting', 'Number formatting']
          }
        ]
      };

      res.json({
        success: true,
        data: templates
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch export templates',
        error: process.env.NODE_ENV === 'development' ? error : undefined
      });
    }
  }
);

/**
 * GET /api/exports/formats
 * Get supported export formats and their capabilities
 */
router.get('/formats',
  requireRole([Role.ADMIN, Role.BACKEND_USER, Role.MANAGER, Role.FIELD_AGENT]),
  async (req: AuthenticatedRequest, res) => {
    try {
      const formats = {
        pdf: {
          name: 'PDF',
          description: 'Portable Document Format with charts and formatting',
          features: ['Charts', 'Formatting', 'Print-ready', 'Secure'],
          maxRecords: 10000,
          supportsCharts: true,
          supportsImages: true
        },
        excel: {
          name: 'Excel',
          description: 'Microsoft Excel format with multiple worksheets',
          features: ['Multiple sheets', 'Formulas', 'Charts', 'Pivot tables'],
          maxRecords: 100000,
          supportsCharts: true,
          supportsImages: false
        },
        csv: {
          name: 'CSV',
          description: 'Comma-separated values for data analysis',
          features: ['Raw data', 'Universal compatibility', 'Large datasets'],
          maxRecords: 1000000,
          supportsCharts: false,
          supportsImages: false
        },
        json: {
          name: 'JSON',
          description: 'JavaScript Object Notation for API integration',
          features: ['Structured data', 'API friendly', 'Programmatic access'],
          maxRecords: 100000,
          supportsCharts: false,
          supportsImages: false
        }
      };

      res.json({
        success: true,
        data: formats
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch export formats',
        error: process.env.NODE_ENV === 'development' ? error : undefined
      });
    }
  }
);

/**
 * SCHEDULED REPORTS ROUTES
 */

/**
 * POST /api/exports/scheduled
 * Create a new scheduled report
 */
router.post('/scheduled',
  requireRole([Role.ADMIN, Role.BACKEND_USER, Role.MANAGER]),
  createScheduledReport
);

/**
 * GET /api/exports/scheduled
 * Get all scheduled reports for the current user
 */
router.get('/scheduled',
  requireRole([Role.ADMIN, Role.BACKEND_USER, Role.MANAGER, Role.FIELD_AGENT]),
  getScheduledReports
);

/**
 * GET /api/exports/scheduled/:id
 * Get a specific scheduled report
 */
router.get('/scheduled/:id',
  requireRole([Role.ADMIN, Role.BACKEND_USER, Role.MANAGER, Role.FIELD_AGENT]),
  getScheduledReport
);

/**
 * PUT /api/exports/scheduled/:id
 * Update a scheduled report
 */
router.put('/scheduled/:id',
  requireRole([Role.ADMIN, Role.BACKEND_USER, Role.MANAGER]),
  updateScheduledReport
);

/**
 * DELETE /api/exports/scheduled/:id
 * Delete a scheduled report
 */
router.delete('/scheduled/:id',
  requireRole([Role.ADMIN, Role.BACKEND_USER, Role.MANAGER]),
  deleteScheduledReport
);

/**
 * PATCH /api/exports/scheduled/:id/toggle
 * Toggle scheduled report active status
 */
router.patch('/scheduled/:id/toggle',
  requireRole([Role.ADMIN, Role.BACKEND_USER, Role.MANAGER]),
  toggleScheduledReport
);

/**
 * GET /api/exports/scheduled/:id/history
 * Get execution history for a scheduled report
 */
router.get('/scheduled/:id/history',
  requireRole([Role.ADMIN, Role.BACKEND_USER, Role.MANAGER]),
  getScheduledReportHistory
);

/**
 * POST /api/exports/scheduled/:id/test
 * Test a scheduled report (execute immediately)
 */
router.post('/scheduled/:id/test',
  requireRole([Role.ADMIN, Role.BACKEND_USER, Role.MANAGER]),
  testScheduledReport
);

export default router;
