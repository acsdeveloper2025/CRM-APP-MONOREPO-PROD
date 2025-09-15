import * as cron from 'node-cron';
import { pool } from '../config/database';
import { logger } from '../utils/logger';
import { PDFExportService } from './PDFExportService';
import { ExcelExportService } from './ExcelExportService';
import { CSVExportService } from './CSVExportService';
import { EmailDeliveryService } from './EmailDeliveryService';

export interface ScheduledReport {
  id: string;
  name: string;
  reportType: 'form-submissions' | 'agent-performance' | 'case-analytics' | 'validation-status';
  format: 'pdf' | 'excel' | 'csv' | 'json';
  frequency: 'daily' | 'weekly' | 'monthly';
  recipients: string[];
  filters?: Record<string, any>;
  options?: Record<string, any>;
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  lastRun?: Date;
  nextRun?: Date;
}

export class ScheduledReportsService {
  private static instance: ScheduledReportsService;
  private scheduledJobs: Map<string, any> = new Map();
  private isInitialized = false;

  private constructor() {}

  public static getInstance(): ScheduledReportsService {
    if (!ScheduledReportsService.instance) {
      ScheduledReportsService.instance = new ScheduledReportsService();
    }
    return ScheduledReportsService.instance;
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Create scheduled_reports table if it doesn't exist
      await this.createScheduledReportsTable();
      
      // Load and schedule existing reports
      await this.loadAndScheduleReports();
      
      this.isInitialized = true;
      logger.info('Scheduled Reports Service initialized successfully');
      
    } catch (error) {
      logger.error('Failed to initialize Scheduled Reports Service:', error);
      throw error;
    }
  }

  private async createScheduledReportsTable(): Promise<void> {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS scheduled_reports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        report_type VARCHAR(50) NOT NULL,
        format VARCHAR(20) NOT NULL,
        frequency VARCHAR(20) NOT NULL,
        recipients JSONB NOT NULL DEFAULT '[]',
        filters JSONB DEFAULT '{}',
        options JSONB DEFAULT '{}',
        is_active BOOLEAN DEFAULT true,
        created_by UUID NOT NULL REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        last_run TIMESTAMP DEFAULT NULL,
        next_run TIMESTAMP DEFAULT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_scheduled_reports_active ON scheduled_reports(is_active);
      CREATE INDEX IF NOT EXISTS idx_scheduled_reports_next_run ON scheduled_reports(next_run);
      CREATE INDEX IF NOT EXISTS idx_scheduled_reports_created_by ON scheduled_reports(created_by);
    `;

    await pool.query(createTableQuery);
  }

  private async loadAndScheduleReports(): Promise<void> {
    try {
      const query = `
        SELECT * FROM scheduled_reports 
        WHERE is_active = true 
        ORDER BY created_at DESC
      `;
      
      const result = await pool.query(query);
      const reports = result.rows;

      for (const report of reports) {
        await this.scheduleReport(this.mapDbRowToScheduledReport(report));
      }

      logger.info(`Loaded and scheduled ${reports.length} active reports`);
      
    } catch (error) {
      logger.error('Error loading scheduled reports:', error);
    }
  }

  public async createScheduledReport(report: Omit<ScheduledReport, 'id' | 'createdAt' | 'lastRun' | 'nextRun'>): Promise<ScheduledReport> {
    try {
      const nextRun = this.calculateNextRun(report.frequency);
      
      const query = `
        INSERT INTO scheduled_reports (
          name, report_type, format, frequency, recipients, filters, options, 
          is_active, created_by, next_run
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `;

      const values = [
        report.name,
        report.reportType,
        report.format,
        report.frequency,
        JSON.stringify(report.recipients),
        JSON.stringify(report.filters || {}),
        JSON.stringify(report.options || {}),
        report.isActive,
        report.createdBy,
        nextRun
      ];

      const result = await pool.query(query, values);
      const createdReport = this.mapDbRowToScheduledReport(result.rows[0]);

      // Schedule the report
      if (createdReport.isActive) {
        await this.scheduleReport(createdReport);
      }

      // Send confirmation email
      const emailService = EmailDeliveryService.getInstance();
      await emailService.sendScheduledReportNotification(
        createdReport.recipients,
        createdReport.reportType,
        createdReport.frequency,
        createdReport.nextRun!
      );

      logger.info(`Created scheduled report: ${createdReport.name} (${createdReport.id})`);
      return createdReport;

    } catch (error) {
      logger.error('Error creating scheduled report:', error);
      throw error;
    }
  }

  public async updateScheduledReport(id: string, updates: Partial<ScheduledReport>): Promise<ScheduledReport> {
    try {
      // Build dynamic update query
      const updateFields = [];
      const values = [];
      let paramIndex = 1;

      if (updates.name !== undefined) {
        updateFields.push(`name = $${paramIndex}`);
        values.push(updates.name);
        paramIndex++;
      }

      if (updates.frequency !== undefined) {
        updateFields.push(`frequency = $${paramIndex}`);
        values.push(updates.frequency);
        paramIndex++;
        
        // Recalculate next run if frequency changed
        updateFields.push(`next_run = $${paramIndex}`);
        values.push(this.calculateNextRun(updates.frequency));
        paramIndex++;
      }

      if (updates.recipients !== undefined) {
        updateFields.push(`recipients = $${paramIndex}`);
        values.push(JSON.stringify(updates.recipients));
        paramIndex++;
      }

      if (updates.filters !== undefined) {
        updateFields.push(`filters = $${paramIndex}`);
        values.push(JSON.stringify(updates.filters));
        paramIndex++;
      }

      if (updates.options !== undefined) {
        updateFields.push(`options = $${paramIndex}`);
        values.push(JSON.stringify(updates.options));
        paramIndex++;
      }

      if (updates.isActive !== undefined) {
        updateFields.push(`is_active = $${paramIndex}`);
        values.push(updates.isActive);
        paramIndex++;
      }

      updateFields.push(`updated_at = NOW()`);

      const query = `
        UPDATE scheduled_reports 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      values.push(id);

      const result = await pool.query(query, values);
      
      if (result.rows.length === 0) {
        throw new Error('Scheduled report not found');
      }

      const updatedReport = this.mapDbRowToScheduledReport(result.rows[0]);

      // Reschedule the report
      this.unscheduleReport(id);
      if (updatedReport.isActive) {
        await this.scheduleReport(updatedReport);
      }

      logger.info(`Updated scheduled report: ${updatedReport.name} (${updatedReport.id})`);
      return updatedReport;

    } catch (error) {
      logger.error('Error updating scheduled report:', error);
      throw error;
    }
  }

  public async deleteScheduledReport(id: string): Promise<void> {
    try {
      // Unschedule the job
      this.unscheduleReport(id);

      // Delete from database
      const query = 'DELETE FROM scheduled_reports WHERE id = $1';
      await pool.query(query, [id]);

      logger.info(`Deleted scheduled report: ${id}`);

    } catch (error) {
      logger.error('Error deleting scheduled report:', error);
      throw error;
    }
  }

  public async getScheduledReports(userId?: string): Promise<ScheduledReport[]> {
    try {
      let query = 'SELECT * FROM scheduled_reports';
      const values = [];

      if (userId) {
        query += ' WHERE created_by = $1';
        values.push(userId);
      }

      query += ' ORDER BY created_at DESC';

      const result = await pool.query(query, values);
      return result.rows.map(row => this.mapDbRowToScheduledReport(row));

    } catch (error) {
      logger.error('Error fetching scheduled reports:', error);
      throw error;
    }
  }

  private async scheduleReport(report: ScheduledReport): Promise<void> {
    try {
      const cronExpression = this.getCronExpression(report.frequency);
      
      const task = cron.schedule(cronExpression, async () => {
        await this.executeScheduledReport(report);
      }, {
        timezone: 'UTC'
      });

      this.scheduledJobs.set(report.id, task);
      
      logger.info(`Scheduled report: ${report.name} (${report.id}) with frequency: ${report.frequency}`);

    } catch (error) {
      logger.error(`Error scheduling report ${report.id}:`, error);
    }
  }

  private unscheduleReport(reportId: string): void {
    const task = this.scheduledJobs.get(reportId);
    if (task) {
      task.stop();
      this.scheduledJobs.delete(reportId);
      logger.info(`Unscheduled report: ${reportId}`);
    }
  }

  private async executeScheduledReport(report: ScheduledReport): Promise<void> {
    try {
      logger.info(`Executing scheduled report: ${report.name} (${report.id})`);

      // Calculate date range for the report
      const dateRange = this.calculateDateRange(report.frequency);

      // Generate the report
      let result;
      switch (report.format) {
        case 'pdf':
          const pdfService = PDFExportService.getInstance();
          result = await pdfService.generatePDFReport({
            reportType: report.reportType,
            dateFrom: dateRange.from,
            dateTo: dateRange.to,
            filters: report.filters,
            ...report.options
          });
          break;

        case 'excel':
          const excelService = ExcelExportService.getInstance();
          result = await excelService.generateExcelReport({
            reportType: report.reportType,
            dateFrom: dateRange.from,
            dateTo: dateRange.to,
            filters: report.filters,
            ...report.options
          });
          break;

        case 'csv':
          const csvService = CSVExportService.getInstance();
          result = await csvService.generateCSVReport({
            reportType: report.reportType,
            dateFrom: dateRange.from,
            dateTo: dateRange.to,
            filters: report.filters,
            ...report.options
          });
          break;

        default:
          throw new Error(`Unsupported format: ${report.format}`);
      }

      if (result.success) {
        // Send email with the report
        const emailService = EmailDeliveryService.getInstance();
        const emailResult = await emailService.sendReportEmail(
          report.recipients,
          report.reportType,
          result.filePath!
        );

        if (emailResult.success) {
          logger.info(`Scheduled report sent successfully: ${report.name}`);
        } else {
          logger.error(`Failed to send scheduled report: ${report.name}`, emailResult.error);
          
          // Send error notification
          await emailService.sendReportErrorNotification(
            report.recipients,
            report.reportType,
            emailResult.error || 'Unknown email error'
          );
        }

        // Clean up the file
        try {
          const fs = require('fs/promises');
          await fs.unlink(result.filePath);
        } catch (cleanupError) {
          logger.warn('Failed to clean up report file:', cleanupError);
        }

      } else {
        logger.error(`Failed to generate scheduled report: ${report.name}`, result.error);
        
        // Send error notification
        const emailService = EmailDeliveryService.getInstance();
        await emailService.sendReportErrorNotification(
          report.recipients,
          report.reportType,
          result.error || 'Unknown generation error'
        );
      }

      // Update last run time and next run time
      await this.updateReportRunTimes(report.id);

    } catch (error) {
      logger.error(`Error executing scheduled report ${report.id}:`, error);
      
      // Send error notification
      const emailService = EmailDeliveryService.getInstance();
      await emailService.sendReportErrorNotification(
        report.recipients,
        report.reportType,
        error instanceof Error ? error.message : 'Unknown execution error'
      );
    }
  }

  private async updateReportRunTimes(reportId: string): Promise<void> {
    try {
      const query = `
        UPDATE scheduled_reports 
        SET last_run = NOW(), 
            next_run = $1,
            updated_at = NOW()
        WHERE id = $2
      `;

      // Get the report to calculate next run
      const reportQuery = 'SELECT frequency FROM scheduled_reports WHERE id = $1';
      const reportResult = await pool.query(reportQuery, [reportId]);
      
      if (reportResult.rows.length > 0) {
        const frequency = reportResult.rows[0].frequency;
        const nextRun = this.calculateNextRun(frequency);
        await pool.query(query, [nextRun, reportId]);
      }

    } catch (error) {
      logger.error('Error updating report run times:', error);
    }
  }

  private getCronExpression(frequency: string): string {
    switch (frequency) {
      case 'daily':
        return '0 8 * * *'; // 8 AM every day
      case 'weekly':
        return '0 8 * * 1'; // 8 AM every Monday
      case 'monthly':
        return '0 8 1 * *'; // 8 AM on the 1st of every month
      default:
        throw new Error(`Unsupported frequency: ${frequency}`);
    }
  }

  private calculateNextRun(frequency: string): Date {
    const now = new Date();
    const nextRun = new Date(now);

    switch (frequency) {
      case 'daily':
        nextRun.setDate(now.getDate() + 1);
        nextRun.setHours(8, 0, 0, 0);
        break;
      case 'weekly':
        const daysUntilMonday = (8 - now.getDay()) % 7 || 7;
        nextRun.setDate(now.getDate() + daysUntilMonday);
        nextRun.setHours(8, 0, 0, 0);
        break;
      case 'monthly':
        nextRun.setMonth(now.getMonth() + 1, 1);
        nextRun.setHours(8, 0, 0, 0);
        break;
      default:
        throw new Error(`Unsupported frequency: ${frequency}`);
    }

    return nextRun;
  }

  private calculateDateRange(frequency: string): { from: string; to: string } {
    const now = new Date();
    const to = now.toISOString().split('T')[0];
    let from: Date;

    switch (frequency) {
      case 'daily':
        from = new Date(now);
        from.setDate(now.getDate() - 1);
        break;
      case 'weekly':
        from = new Date(now);
        from.setDate(now.getDate() - 7);
        break;
      case 'monthly':
        from = new Date(now);
        from.setMonth(now.getMonth() - 1);
        break;
      default:
        from = new Date(now);
        from.setDate(now.getDate() - 7);
    }

    return {
      from: from.toISOString().split('T')[0],
      to
    };
  }

  private mapDbRowToScheduledReport(row: any): ScheduledReport {
    return {
      id: row.id,
      name: row.name,
      reportType: row.report_type,
      format: row.format,
      frequency: row.frequency,
      recipients: Array.isArray(row.recipients) ? row.recipients : JSON.parse(row.recipients || '[]'),
      filters: typeof row.filters === 'object' ? row.filters : JSON.parse(row.filters || '{}'),
      options: typeof row.options === 'object' ? row.options : JSON.parse(row.options || '{}'),
      isActive: row.is_active,
      createdBy: row.created_by,
      createdAt: new Date(row.created_at),
      lastRun: row.last_run ? new Date(row.last_run) : undefined,
      nextRun: row.next_run ? new Date(row.next_run) : undefined
    };
  }

  public async shutdown(): Promise<void> {
    // Stop all scheduled jobs
    for (const [reportId, task] of this.scheduledJobs) {
      task.stop();
      logger.info(`Stopped scheduled report: ${reportId}`);
    }
    
    this.scheduledJobs.clear();
    this.isInitialized = false;
    
    logger.info('Scheduled Reports Service shut down');
  }
}
