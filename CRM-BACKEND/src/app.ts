import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '@/config';
import { logger } from '@/config/logger';
import { errorHandler, notFoundHandler } from '@/middleware/errorHandler';
import { ScheduledReportsService } from '@/services/ScheduledReportsService';
import { generalRateLimit } from '@/middleware/rateLimiter';
// Performance monitoring middleware available for future use
// import {
//   performanceMonitoring,
//   memoryMonitoring,
//   databaseMonitoring,
// } from '@/middleware/performanceMonitoring';

// Import routes
import authRoutes from '@/routes/auth';
import caseRoutes from '@/routes/cases';
import clientRoutes from '@/routes/clients';
import attachmentRoutes from '@/routes/attachments';
import userRoutes from '@/routes/user';
import usersRoutes from '@/routes/users';
import userTerritoryRoutes from './routes/userTerritory';
import territoryAssignmentsRoutes from '@/routes/territoryAssignments'; // Legacy but used by frontend
import dashboardRoutes from '@/routes/dashboard';
import productsRoutes from '@/routes/products';
import verificationTypesRoutes from '@/routes/verification-types';
import documentTypesRoutes from './routes/document-types';
import clientDocumentTypesRoutes from './routes/client-document-types';
import documentTypeRatesRoutes from './routes/document-type-rates';
import invoicesRoutes from '@/routes/invoices';
import commissionsRoutes from '@/routes/commissions';
import commissionManagementRoutes from './routes/commissionManagement';
import citiesRoutes from '@/routes/cities';
import statesRoutes from '@/routes/states';
import countriesRoutes from '@/routes/countries';
import pincodesRoutes from '@/routes/pincodes';
import areasRoutes from '@/routes/areas';
import rolesRoutes from '@/routes/roles';
import rbacRoutes from '@/routes/rbac';
import departmentsRoutes from '@/routes/departments';
import designationsRoutes from '@/routes/designations';

// Removed mock locations routes - using individual database-driven routes instead
import reportsRoutes from '@/routes/reports';
import enhancedAnalyticsRoutes from '@/routes/enhancedAnalytics';
import exportsRoutes from '@/routes/exports';
import auditLogsRoutes from '@/routes/audit-logs';
// Geolocation routes removed for production
import formRoutes from '@/routes/forms';
import notificationRoutes from '@/routes/notifications';
import mobileRoutes from '@/routes/mobile';
import securityRoutes from '@/routes/security';
import deduplicationRoutes from '@/routes/deduplication';
import rateTypesRoutes from '@/routes/rate-types';
import rateTypeAssignmentsRoutes from '@/routes/rate-type-assignments';
import ratesRoutes from '@/routes/rates';
import healthRoutes from '@/routes/health';
import aiReportsRoutes from '@/routes/aiReports';
import verificationTasksRoutes from '@/routes/verificationTasks';
import templateReportsRoutes from '@/routes/templateReports';

const app = express();

// Trust proxy for X-Forwarded-For headers from Nginx (specific to localhost)
app.set('trust proxy', ['127.0.0.1', '::1']);

// Security middleware
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// CORS configuration
app.use(
  cors({
    origin: config.corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-App-Version',
      'X-App-Environment',
      'X-Platform',
      'X-Device-Model',
      'X-OS-Version',
      'X-Client-Type',
      // Standard browser headers
      'User-Agent',
      'Accept',
      'Accept-Language',
      'Accept-Encoding',
      'Cache-Control',
      'Connection',
      'Host',
      'Origin',
      'Referer',
      'Sec-Fetch-Dest',
      'Sec-Fetch-Mode',
      'Sec-Fetch-Site',
      // Additional headers for mobile apps
      'X-Forwarded-For',
      'X-Real-IP',
      'X-Forwarded-Proto',
    ],
    exposedHeaders: ['Content-Disposition', 'Content-Type', 'Content-Length'],
  })
);

// Request logging
app.use(
  morgan('combined', {
    stream: {
      write: (message: string) => {
        logger.info(message.trim());
      },
    },
  })
);

// Body parsing middleware - Increased limits for mobile app form submissions with multiple images
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Performance monitoring middleware (temporarily disabled)
// app.use(performanceMonitoring);
// app.use(memoryMonitoring);
// app.use(databaseMonitoring);

// Rate limiting
app.use('/api', generalRateLimit);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is healthy',
    data: {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: config.nodeEnv,
    },
  });
});

// Health check routes (comprehensive monitoring)
app.use('/api', healthRoutes);

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/cases', caseRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/clients', clientDocumentTypesRoutes);
app.use('/api/attachments', attachmentRoutes);
app.use('/api/user', userRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/users', userTerritoryRoutes);
app.use('/api/territory-assignments', territoryAssignmentsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/verification-types', verificationTypesRoutes);
app.use('/api/document-types', documentTypesRoutes);
app.use('/api/document-type-rates', documentTypeRatesRoutes);
app.use('/api/invoices', invoicesRoutes);
app.use('/api/commissions', commissionsRoutes);
app.use('/api/commission-management', commissionManagementRoutes);
app.use('/api/cities', citiesRoutes);
app.use('/api/states', statesRoutes);
app.use('/api/countries', countriesRoutes);
app.use('/api/pincodes', pincodesRoutes);
app.use('/api/areas', areasRoutes);
app.use('/api/roles', rolesRoutes);
app.use('/api/rbac', rbacRoutes);
app.use('/api/permissions', rbacRoutes);
app.use('/api/departments', departmentsRoutes);
app.use('/api/designations', designationsRoutes);

// Removed mock locations routes - using individual database-driven routes instead
app.use('/api/reports', reportsRoutes);
app.use('/api/enhanced-analytics', enhancedAnalyticsRoutes);
app.use('/api/exports', exportsRoutes);
app.use('/api/audit-logs', auditLogsRoutes);
// Geolocation routes removed for production
app.use('/api/forms', formRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/security', securityRoutes);
app.use('/api/cases/deduplication', deduplicationRoutes);
app.use('/api/rate-types', rateTypesRoutes);
app.use('/api/rate-type-assignments', rateTypeAssignmentsRoutes);
app.use('/api/rates', ratesRoutes);
app.use('/api/ai-reports', aiReportsRoutes);
app.use('/api/template-reports', templateReportsRoutes);

// Multi-verification task routes
app.use('/api', verificationTasksRoutes);

// Temporary AI test endpoint
app.get('/api/ai-test', async (req, res) => {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt =
      'Generate a brief test response to verify the AI integration is working in the CRM system.';

    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    res.json({
      success: true,
      message: 'AI integration working',
      data: { response: text },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'AI integration failed',
      error: error.message,
    });
  }
});

// Mobile API routes
app.use('/api/mobile', mobileRoutes);

// NOTE: Uploads are now served through authenticated API endpoints only
// Removed public static file serving for security: app.use('/uploads', express.static(config.uploadPath));

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// Initialize Scheduled Reports Service
const initializeScheduledReports = async () => {
  try {
    const scheduledReportsService = ScheduledReportsService.getInstance();
    await scheduledReportsService.initialize();
    logger.info('Scheduled Reports Service initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize Scheduled Reports Service:', error);
  }
};

// Initialize scheduled reports when the app starts
if (process.env.NODE_ENV !== 'test') {
  void initializeScheduledReports();
}

export default app;
