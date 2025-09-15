import puppeteer, { Browser, PDFOptions } from 'puppeteer';
import { pool } from '../config/database';
import { logger } from '../utils/logger';
import path from 'path';
import fs from 'fs/promises';

export interface PDFExportOptions {
  reportType: 'form-submissions' | 'agent-performance' | 'case-analytics' | 'validation-status';
  dateFrom?: string;
  dateTo?: string;
  filters?: Record<string, any>;
  template?: 'standard' | 'detailed' | 'summary';
  includeCharts?: boolean;
  orientation?: 'portrait' | 'landscape';
}

export interface PDFExportResult {
  success: boolean;
  filePath?: string;
  fileName?: string;
  fileSize?: number;
  error?: string;
}

export class PDFExportService {
  private static instance: PDFExportService;
  private browser: Browser | null = null;

  private constructor() {}

  public static getInstance(): PDFExportService {
    if (!PDFExportService.instance) {
      PDFExportService.instance = new PDFExportService();
    }
    return PDFExportService.instance;
  }

  private async initBrowser(): Promise<void> {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
    }
  }

  private async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  public async generatePDFReport(options: PDFExportOptions): Promise<PDFExportResult> {
    try {
      await this.initBrowser();
      
      // Generate data based on report type
      const data = await this.fetchReportData(options);
      
      // Generate HTML content
      const htmlContent = await this.generateHTMLContent(data, options);
      
      // Create PDF from HTML
      const pdfBuffer = await this.createPDFFromHTML(htmlContent, options);
      
      // Save PDF file
      const fileName = this.generateFileName(options);
      const filePath = path.join(process.cwd(), 'exports', fileName);
      
      // Ensure exports directory exists
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      
      // Write PDF file
      await fs.writeFile(filePath, pdfBuffer);
      
      const stats = await fs.stat(filePath);
      
      logger.info(`PDF report generated successfully: ${fileName}`);
      
      return {
        success: true,
        filePath,
        fileName,
        fileSize: stats.size
      };

    } catch (error) {
      logger.error('Error generating PDF report:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async fetchReportData(options: PDFExportOptions): Promise<any> {
    const { reportType, dateFrom, dateTo, filters } = options;

    switch (reportType) {
      case 'form-submissions':
        return await this.fetchFormSubmissionsData(dateFrom, dateTo, filters);
      case 'agent-performance':
        return await this.fetchAgentPerformanceData(dateFrom, dateTo, filters);
      case 'case-analytics':
        return await this.fetchCaseAnalyticsData(dateFrom, dateTo, filters);
      case 'validation-status':
        return await this.fetchValidationStatusData(dateFrom, dateTo, filters);
      default:
        throw new Error(`Unsupported report type: ${reportType}`);
    }
  }

  private async fetchFormSubmissionsData(dateFrom?: string, dateTo?: string, filters?: any): Promise<any> {
    let whereConditions = [];
    let queryParams = [];
    let paramIndex = 1;

    if (dateFrom) {
      whereConditions.push(`fs.submitted_at >= $${paramIndex}`);
      queryParams.push(dateFrom);
      paramIndex++;
    }

    if (dateTo) {
      whereConditions.push(`fs.submitted_at <= $${paramIndex}`);
      queryParams.push(dateTo);
      paramIndex++;
    }

    if (filters?.formType) {
      whereConditions.push(`fs.form_type = $${paramIndex}`);
      queryParams.push(filters.formType);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const query = `
      SELECT 
        fs.*,
        fqm.overall_quality_score,
        fqm.completeness_score,
        fqm.accuracy_score
      FROM form_submission_analytics fs
      LEFT JOIN form_quality_metrics fqm ON fs.id = fqm.form_submission_id
      ${whereClause}
      ORDER BY fs.submitted_at DESC
      LIMIT 1000
    `;

    const summaryQuery = `
      SELECT 
        COUNT(*) as total_submissions,
        COUNT(CASE WHEN validation_status = 'VALID' THEN 1 END) as valid_submissions,
        COUNT(CASE WHEN validation_status = 'PENDING' THEN 1 END) as pending_submissions,
        AVG(submission_score) as avg_submission_score,
        AVG(photos_count) as avg_photos_per_form
      FROM form_submission_analytics
      ${whereClause}
    `;

    const [submissionsResult, summaryResult] = await Promise.all([
      pool.query(query, queryParams),
      pool.query(summaryQuery, queryParams)
    ]);

    return {
      submissions: submissionsResult.rows,
      summary: summaryResult.rows[0],
      reportType: 'Form Submissions Report',
      generatedAt: new Date().toISOString(),
      dateRange: { from: dateFrom, to: dateTo }
    };
  }

  private async fetchAgentPerformanceData(dateFrom?: string, dateTo?: string, filters?: any): Promise<any> {
    let whereConditions = [];
    let queryParams = [];
    let paramIndex = 1;

    if (dateFrom) {
      whereConditions.push(`apd.date >= $${paramIndex}`);
      queryParams.push(dateFrom);
      paramIndex++;
    }

    if (dateTo) {
      whereConditions.push(`apd.date <= $${paramIndex}`);
      queryParams.push(dateTo);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const query = `
      SELECT 
        u.id,
        u.name,
        u."employeeId",
        u.email,
        d.name as department_name,
        COUNT(DISTINCT apd.date) as active_days,
        COALESCE(SUM(apd.cases_assigned), 0) as total_cases_assigned,
        COALESCE(SUM(apd.cases_completed), 0) as cases_completed,
        COALESCE(SUM(apd.forms_submitted), 0) as total_forms_submitted,
        COALESCE(AVG(apd.quality_score), 0) as avg_quality_score,
        COALESCE(AVG(apd.validation_success_rate), 0) as avg_validation_success_rate
      FROM users u
      LEFT JOIN departments d ON u."departmentId" = d.id
      LEFT JOIN agent_performance_daily apd ON u.id = apd.agent_id
      ${whereClause}
      AND u.role = 'FIELD_AGENT'
      GROUP BY u.id, u.name, u."employeeId", u.email, d.name
      ORDER BY avg_quality_score DESC
    `;

    const result = await pool.query(query, queryParams);

    return {
      agents: result.rows,
      reportType: 'Agent Performance Report',
      generatedAt: new Date().toISOString(),
      dateRange: { from: dateFrom, to: dateTo }
    };
  }

  private async fetchCaseAnalyticsData(dateFrom?: string, dateTo?: string, filters?: any): Promise<any> {
    let whereConditions = [];
    let queryParams = [];
    let paramIndex = 1;

    if (dateFrom) {
      whereConditions.push(`c."createdAt" >= $${paramIndex}`);
      queryParams.push(dateFrom);
      paramIndex++;
    }

    if (dateTo) {
      whereConditions.push(`c."createdAt" <= $${paramIndex}`);
      queryParams.push(dateTo);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const query = `
      SELECT * FROM case_completion_analytics
      ${whereClause}
      ORDER BY "createdAt" DESC
      LIMIT 1000
    `;

    const summaryQuery = `
      SELECT 
        COUNT(*) as total_cases,
        COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as completed_cases,
        AVG(completion_days) as avg_completion_days,
        AVG(quality_score) as avg_quality_score
      FROM case_completion_analytics
      ${whereClause}
    `;

    const [casesResult, summaryResult] = await Promise.all([
      pool.query(query, queryParams),
      pool.query(summaryQuery, queryParams)
    ]);

    return {
      cases: casesResult.rows,
      summary: summaryResult.rows[0],
      reportType: 'Case Analytics Report',
      generatedAt: new Date().toISOString(),
      dateRange: { from: dateFrom, to: dateTo }
    };
  }

  private async fetchValidationStatusData(dateFrom?: string, dateTo?: string, filters?: any): Promise<any> {
    let whereConditions = [];
    let queryParams = [];
    let paramIndex = 1;

    if (dateFrom) {
      whereConditions.push(`fs.submitted_at >= $${paramIndex}`);
      queryParams.push(dateFrom);
      paramIndex++;
    }

    if (dateTo) {
      whereConditions.push(`fs.submitted_at <= $${paramIndex}`);
      queryParams.push(dateTo);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const query = `
      SELECT 
        fs.form_type,
        fs.validation_status,
        COUNT(*) as form_count,
        AVG(fs.submission_score) as avg_submission_score,
        AVG(fqm.overall_quality_score) as avg_quality_score
      FROM form_submissions fs
      LEFT JOIN form_quality_metrics fqm ON fs.id = fqm.form_submission_id
      ${whereClause}
      GROUP BY fs.form_type, fs.validation_status
      ORDER BY fs.form_type, fs.validation_status
    `;

    const result = await pool.query(query, queryParams);

    return {
      validationData: result.rows,
      reportType: 'Form Validation Status Report',
      generatedAt: new Date().toISOString(),
      dateRange: { from: dateFrom, to: dateTo }
    };
  }

  private async generateHTMLContent(data: any, options: PDFExportOptions): Promise<string> {
    const { template = 'standard', includeCharts = false } = options;

    const baseHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${data.reportType}</title>
        <style>
          ${this.getReportCSS()}
        </style>
      </head>
      <body>
        ${this.generateReportHeader(data)}
        ${this.generateReportContent(data, options)}
        ${this.generateReportFooter(data)}
      </body>
      </html>
    `;

    return baseHTML;
  }

  private getReportCSS(): string {
    return `
      body {
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        margin: 0;
        padding: 20px;
        color: #333;
        line-height: 1.6;
      }
      .header {
        text-align: center;
        border-bottom: 3px solid #007bff;
        padding-bottom: 20px;
        margin-bottom: 30px;
      }
      .header h1 {
        color: #007bff;
        margin: 0;
        font-size: 28px;
      }
      .header .meta {
        color: #666;
        margin-top: 10px;
      }
      .summary-cards {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 20px;
        margin-bottom: 30px;
      }
      .card {
        background: #f8f9fa;
        border: 1px solid #dee2e6;
        border-radius: 8px;
        padding: 20px;
        text-align: center;
      }
      .card h3 {
        margin: 0 0 10px 0;
        color: #495057;
        font-size: 14px;
        text-transform: uppercase;
      }
      .card .value {
        font-size: 24px;
        font-weight: bold;
        color: #007bff;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 20px;
        font-size: 12px;
      }
      th, td {
        border: 1px solid #dee2e6;
        padding: 8px;
        text-align: left;
      }
      th {
        background-color: #007bff;
        color: white;
        font-weight: bold;
      }
      tr:nth-child(even) {
        background-color: #f8f9fa;
      }
      .footer {
        margin-top: 40px;
        padding-top: 20px;
        border-top: 1px solid #dee2e6;
        text-align: center;
        color: #666;
        font-size: 12px;
      }
      .status-badge {
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 10px;
        font-weight: bold;
        text-transform: uppercase;
      }
      .status-valid { background: #d4edda; color: #155724; }
      .status-pending { background: #fff3cd; color: #856404; }
      .status-invalid { background: #f8d7da; color: #721c24; }
    `;
  }

  private generateReportHeader(data: any): string {
    return `
      <div class="header">
        <h1>${data.reportType}</h1>
        <div class="meta">
          <p>Generated on: ${new Date(data.generatedAt).toLocaleString()}</p>
          ${data.dateRange?.from ? `<p>Date Range: ${data.dateRange.from} to ${data.dateRange.to}</p>` : ''}
        </div>
      </div>
    `;
  }

  private generateReportContent(data: any, options: PDFExportOptions): string {
    switch (options.reportType) {
      case 'form-submissions':
        return this.generateFormSubmissionsContent(data);
      case 'agent-performance':
        return this.generateAgentPerformanceContent(data);
      case 'case-analytics':
        return this.generateCaseAnalyticsContent(data);
      case 'validation-status':
        return this.generateValidationStatusContent(data);
      default:
        return '<p>Unsupported report type</p>';
    }
  }

  private generateFormSubmissionsContent(data: any): string {
    const summary = data.summary;
    const submissions = data.submissions;

    return `
      <div class="summary-cards">
        <div class="card">
          <h3>Total Submissions</h3>
          <div class="value">${summary.total_submissions || 0}</div>
        </div>
        <div class="card">
          <h3>Valid Submissions</h3>
          <div class="value">${summary.valid_submissions || 0}</div>
        </div>
        <div class="card">
          <h3>Pending Review</h3>
          <div class="value">${summary.pending_submissions || 0}</div>
        </div>
        <div class="card">
          <h3>Avg Quality Score</h3>
          <div class="value">${summary.avg_submission_score ? parseFloat(summary.avg_submission_score).toFixed(1) : 'N/A'}</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Form Type</th>
            <th>Agent</th>
            <th>Case</th>
            <th>Status</th>
            <th>Score</th>
            <th>Photos</th>
            <th>Submitted</th>
          </tr>
        </thead>
        <tbody>
          ${submissions.map((sub: any) => `
            <tr>
              <td>${sub.form_type}</td>
              <td>${sub.agent_name || 'N/A'}</td>
              <td>#${sub.case_number} - ${sub.customer_name}</td>
              <td><span class="status-badge status-${sub.validation_status.toLowerCase()}">${sub.validation_status}</span></td>
              <td>${sub.submission_score || 'N/A'}</td>
              <td>${sub.photos_count || 0}</td>
              <td>${new Date(sub.submitted_at).toLocaleDateString()}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  private generateAgentPerformanceContent(data: any): string {
    const agents = data.agents;

    return `
      <table>
        <thead>
          <tr>
            <th>Agent Name</th>
            <th>Employee ID</th>
            <th>Department</th>
            <th>Cases Assigned</th>
            <th>Cases Completed</th>
            <th>Forms Submitted</th>
            <th>Quality Score</th>
            <th>Validation Rate</th>
          </tr>
        </thead>
        <tbody>
          ${agents.map((agent: any) => `
            <tr>
              <td>${agent.name}</td>
              <td>${agent.employeeId || 'N/A'}</td>
              <td>${agent.department_name || 'N/A'}</td>
              <td>${agent.total_cases_assigned}</td>
              <td>${agent.cases_completed}</td>
              <td>${agent.total_forms_submitted}</td>
              <td>${agent.avg_quality_score ? parseFloat(agent.avg_quality_score).toFixed(1) : 'N/A'}</td>
              <td>${agent.avg_validation_success_rate ? parseFloat(agent.avg_validation_success_rate).toFixed(1) + '%' : 'N/A'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  private generateCaseAnalyticsContent(data: any): string {
    const summary = data.summary;
    const cases = data.cases;

    return `
      <div class="summary-cards">
        <div class="card">
          <h3>Total Cases</h3>
          <div class="value">${summary.total_cases || 0}</div>
        </div>
        <div class="card">
          <h3>Completed Cases</h3>
          <div class="value">${summary.completed_cases || 0}</div>
        </div>
        <div class="card">
          <h3>Avg Completion Days</h3>
          <div class="value">${summary.avg_completion_days ? parseFloat(summary.avg_completion_days).toFixed(1) : 'N/A'}</div>
        </div>
        <div class="card">
          <h3>Avg Quality Score</h3>
          <div class="value">${summary.avg_quality_score ? parseFloat(summary.avg_quality_score).toFixed(1) : 'N/A'}</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Case ID</th>
            <th>Customer</th>
            <th>Agent</th>
            <th>Status</th>
            <th>Completion Days</th>
            <th>Quality Score</th>
            <th>Forms</th>
          </tr>
        </thead>
        <tbody>
          ${cases.slice(0, 50).map((caseItem: any) => `
            <tr>
              <td>#${caseItem.caseId}</td>
              <td>${caseItem.customerName}</td>
              <td>${caseItem.agent_name || 'Unassigned'}</td>
              <td>${caseItem.status}</td>
              <td>${caseItem.completion_days ? parseFloat(caseItem.completion_days).toFixed(1) : 'N/A'}</td>
              <td>${caseItem.quality_score || 'N/A'}</td>
              <td>${caseItem.actual_forms_submitted || 0}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  private generateValidationStatusContent(data: any): string {
    const validationData = data.validationData;

    return `
      <table>
        <thead>
          <tr>
            <th>Form Type</th>
            <th>Validation Status</th>
            <th>Form Count</th>
            <th>Avg Submission Score</th>
            <th>Avg Quality Score</th>
          </tr>
        </thead>
        <tbody>
          ${validationData.map((item: any) => `
            <tr>
              <td>${item.form_type}</td>
              <td><span class="status-badge status-${item.validation_status.toLowerCase()}">${item.validation_status}</span></td>
              <td>${item.form_count}</td>
              <td>${item.avg_submission_score ? parseFloat(item.avg_submission_score).toFixed(1) : 'N/A'}</td>
              <td>${item.avg_quality_score ? parseFloat(item.avg_quality_score).toFixed(1) : 'N/A'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  private generateReportFooter(data: any): string {
    return `
      <div class="footer">
        <p>This report was automatically generated by the CRM Analytics System</p>
        <p>© ${new Date().getFullYear()} CRM Analytics Platform</p>
      </div>
    `;
  }

  private async createPDFFromHTML(htmlContent: string, options: PDFExportOptions): Promise<Buffer> {
    if (!this.browser) {
      throw new Error('Browser not initialized');
    }

    const page = await this.browser.newPage();
    
    try {
      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
      
      const pdfOptions: PDFOptions = {
        format: 'A4',
        landscape: options.orientation === 'landscape',
        margin: {
          top: '20mm',
          right: '15mm',
          bottom: '20mm',
          left: '15mm'
        },
        printBackground: true,
        preferCSSPageSize: true
      };

      const pdfBuffer = await page.pdf(pdfOptions);
      return Buffer.from(pdfBuffer);
      
    } finally {
      await page.close();
    }
  }

  private generateFileName(options: PDFExportOptions): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const reportType = options.reportType.replace(/-/g, '_');
    return `${reportType}_report_${timestamp}.pdf`;
  }

  public async cleanup(): Promise<void> {
    await this.closeBrowser();
  }
}
