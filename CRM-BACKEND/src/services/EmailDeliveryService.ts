import nodemailer from 'nodemailer';
import { logger } from '../utils/logger';
import path from 'path';
import fs from 'fs/promises';

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

export interface EmailAttachment {
  filename: string;
  path: string;
  contentType?: string;
}

export interface EmailOptions {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  text?: string;
  html?: string;
  attachments?: EmailAttachment[];
  replyTo?: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  rejectedRecipients?: string[];
}

export class EmailDeliveryService {
  private static instance: EmailDeliveryService;
  private transporter: nodemailer.Transporter | null = null;
  private config: EmailConfig;

  private constructor() {
    this.config = {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || ''
      }
    };
  }

  public static getInstance(): EmailDeliveryService {
    if (!EmailDeliveryService.instance) {
      EmailDeliveryService.instance = new EmailDeliveryService();
    }
    return EmailDeliveryService.instance;
  }

  private async initializeTransporter(): Promise<void> {
    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host: this.config.host,
        port: this.config.port,
        secure: this.config.secure,
        auth: this.config.auth,
        tls: {
          rejectUnauthorized: false
        }
      });

      // Verify connection
      try {
        await this.transporter.verify();
        logger.info('Email transporter initialized successfully');
      } catch (error) {
        logger.error('Failed to initialize email transporter:', error);
        throw new Error('Email service configuration error');
      }
    }
  }

  public async sendEmail(options: EmailOptions): Promise<EmailResult> {
    try {
      await this.initializeTransporter();

      if (!this.transporter) {
        throw new Error('Email transporter not initialized');
      }

      const mailOptions = {
        from: `"CRM Analytics System" <${this.config.auth.user}>`,
        to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
        cc: options.cc ? (Array.isArray(options.cc) ? options.cc.join(', ') : options.cc) : undefined,
        bcc: options.bcc ? (Array.isArray(options.bcc) ? options.bcc.join(', ') : options.bcc) : undefined,
        subject: options.subject,
        text: options.text,
        html: options.html,
        attachments: options.attachments,
        replyTo: options.replyTo || this.config.auth.user
      };

      const result = await this.transporter.sendMail(mailOptions);

      logger.info(`Email sent successfully to ${options.to}. Message ID: ${result.messageId}`);

      return {
        success: true,
        messageId: result.messageId,
        rejectedRecipients: result.rejected as string[]
      };

    } catch (error) {
      logger.error('Error sending email:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown email error'
      };
    }
  }

  public async sendReportEmail(
    recipients: string[],
    reportType: string,
    filePath: string,
    reportData?: any
  ): Promise<EmailResult> {
    try {
      const fileName = path.basename(filePath);
      const fileStats = await fs.stat(filePath);
      
      const emailOptions: EmailOptions = {
        to: recipients,
        subject: `CRM Analytics Report - ${this.formatReportType(reportType)}`,
        html: this.generateReportEmailHTML(reportType, fileName, fileStats.size, reportData),
        text: this.generateReportEmailText(reportType, fileName, fileStats.size, reportData),
        attachments: [
          {
            filename: fileName,
            path: filePath,
            contentType: this.getContentType(fileName)
          }
        ]
      };

      return await this.sendEmail(emailOptions);

    } catch (error) {
      logger.error('Error sending report email:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send report email'
      };
    }
  }

  public async sendScheduledReportNotification(
    recipients: string[],
    reportType: string,
    schedule: string,
    nextRun: Date
  ): Promise<EmailResult> {
    const emailOptions: EmailOptions = {
      to: recipients,
      subject: `Scheduled Report Confirmation - ${this.formatReportType(reportType)}`,
      html: this.generateScheduleConfirmationHTML(reportType, schedule, nextRun),
      text: this.generateScheduleConfirmationText(reportType, schedule, nextRun)
    };

    return await this.sendEmail(emailOptions);
  }

  public async sendReportErrorNotification(
    recipients: string[],
    reportType: string,
    error: string
  ): Promise<EmailResult> {
    const emailOptions: EmailOptions = {
      to: recipients,
      subject: `Report Generation Failed - ${this.formatReportType(reportType)}`,
      html: this.generateErrorNotificationHTML(reportType, error),
      text: this.generateErrorNotificationText(reportType, error)
    };

    return await this.sendEmail(emailOptions);
  }

  private formatReportType(reportType: string): string {
    return reportType
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private getContentType(fileName: string): string {
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

  private generateReportEmailHTML(
    reportType: string,
    fileName: string,
    fileSize: number,
    reportData?: any
  ): string {
    const formattedSize = this.formatFileSize(fileSize);
    const reportTitle = this.formatReportType(reportType);

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>CRM Analytics Report</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #007bff; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f8f9fa; }
          .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
          .attachment-info { background: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
          .summary-table { width: 100%; border-collapse: collapse; margin: 15px 0; }
          .summary-table th, .summary-table td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
          .summary-table th { background: #f1f1f1; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>CRM Analytics Report</h1>
            <p>${reportTitle}</p>
          </div>
          
          <div class="content">
            <h2>Report Generated Successfully</h2>
            <p>Your requested ${reportTitle.toLowerCase()} has been generated and is attached to this email.</p>
            
            <div class="attachment-info">
              <h3>📎 Attachment Details</h3>
              <p><strong>File Name:</strong> ${fileName}</p>
              <p><strong>File Size:</strong> ${formattedSize}</p>
              <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
            </div>

            ${reportData ? this.generateReportSummaryHTML(reportData) : ''}
            
            <p><strong>Note:</strong> This report contains sensitive business data. Please handle it securely and in accordance with your organization's data protection policies.</p>
          </div>
          
          <div class="footer">
            <p>This email was automatically generated by the CRM Analytics System.</p>
            <p>© ${new Date().getFullYear()} CRM Analytics Platform</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generateReportEmailText(
    reportType: string,
    fileName: string,
    fileSize: number,
    reportData?: any
  ): string {
    const formattedSize = this.formatFileSize(fileSize);
    const reportTitle = this.formatReportType(reportType);

    return `
CRM Analytics Report - ${reportTitle}

Your requested ${reportTitle.toLowerCase()} has been generated and is attached to this email.

Attachment Details:
- File Name: ${fileName}
- File Size: ${formattedSize}
- Generated: ${new Date().toLocaleString()}

${reportData ? this.generateReportSummaryText(reportData) : ''}

Note: This report contains sensitive business data. Please handle it securely and in accordance with your organization's data protection policies.

---
This email was automatically generated by the CRM Analytics System.
© ${new Date().getFullYear()} CRM Analytics Platform
    `;
  }

  private generateScheduleConfirmationHTML(
    reportType: string,
    schedule: string,
    nextRun: Date
  ): string {
    const reportTitle = this.formatReportType(reportType);

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Scheduled Report Confirmation</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #28a745; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f8f9fa; }
          .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
          .schedule-info { background: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Scheduled Report Confirmed</h1>
          </div>
          
          <div class="content">
            <h2>Report Schedule Activated</h2>
            <p>Your scheduled report has been successfully configured and activated.</p>
            
            <div class="schedule-info">
              <h3>📅 Schedule Details</h3>
              <p><strong>Report Type:</strong> ${reportTitle}</p>
              <p><strong>Frequency:</strong> ${schedule}</p>
              <p><strong>Next Report:</strong> ${nextRun.toLocaleString()}</p>
            </div>
            
            <p>You will receive the report automatically according to the schedule above. You can modify or cancel this schedule at any time through the CRM Analytics dashboard.</p>
          </div>
          
          <div class="footer">
            <p>This email was automatically generated by the CRM Analytics System.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generateScheduleConfirmationText(
    reportType: string,
    schedule: string,
    nextRun: Date
  ): string {
    const reportTitle = this.formatReportType(reportType);

    return `
Scheduled Report Confirmation

Your scheduled report has been successfully configured and activated.

Schedule Details:
- Report Type: ${reportTitle}
- Frequency: ${schedule}
- Next Report: ${nextRun.toLocaleString()}

You will receive the report automatically according to the schedule above. You can modify or cancel this schedule at any time through the CRM Analytics dashboard.

---
This email was automatically generated by the CRM Analytics System.
    `;
  }

  private generateErrorNotificationHTML(reportType: string, error: string): string {
    const reportTitle = this.formatReportType(reportType);

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Report Generation Failed</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #dc3545; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f8f9fa; }
          .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
          .error-info { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>❌ Report Generation Failed</h1>
          </div>
          
          <div class="content">
            <h2>Report Generation Error</h2>
            <p>We encountered an error while generating your ${reportTitle.toLowerCase()}.</p>
            
            <div class="error-info">
              <h3>⚠️ Error Details</h3>
              <p><strong>Report Type:</strong> ${reportTitle}</p>
              <p><strong>Error:</strong> ${error}</p>
              <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
            </div>
            
            <p>Our technical team has been notified of this issue. Please try generating the report again, or contact support if the problem persists.</p>
          </div>
          
          <div class="footer">
            <p>This email was automatically generated by the CRM Analytics System.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generateErrorNotificationText(reportType: string, error: string): string {
    const reportTitle = this.formatReportType(reportType);

    return `
Report Generation Failed

We encountered an error while generating your ${reportTitle.toLowerCase()}.

Error Details:
- Report Type: ${reportTitle}
- Error: ${error}
- Time: ${new Date().toLocaleString()}

Our technical team has been notified of this issue. Please try generating the report again, or contact support if the problem persists.

---
This email was automatically generated by the CRM Analytics System.
    `;
  }

  private generateReportSummaryHTML(reportData: any): string {
    if (!reportData.summary) return '';

    return `
      <div class="attachment-info">
        <h3>📊 Report Summary</h3>
        <table class="summary-table">
          ${Object.entries(reportData.summary).map(([key, value]) => `
            <tr>
              <th>${key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</th>
              <td>${this.formatSummaryValue(value)}</td>
            </tr>
          `).join('')}
        </table>
      </div>
    `;
  }

  private generateReportSummaryText(reportData: any): string {
    if (!reportData.summary) return '';

    const summaryText = Object.entries(reportData.summary)
      .map(([key, value]) => `${key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}: ${this.formatSummaryValue(value)}`)
      .join('\n');

    return `\nReport Summary:\n${summaryText}\n`;
  }

  private formatSummaryValue(value: any): string {
    if (typeof value === 'number') {
      if (Number.isInteger(value)) {
        return value.toLocaleString();
      } else {
        return value.toFixed(2);
      }
    }
    return String(value || 'N/A');
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  public async testConnection(): Promise<boolean> {
    try {
      await this.initializeTransporter();
      return true;
    } catch (error) {
      logger.error('Email connection test failed:', error);
      return false;
    }
  }
}
