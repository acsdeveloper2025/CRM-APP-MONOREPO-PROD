import express from 'express';
import path from 'path';
import compression from 'compression';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
// Phase E5: cookie-parser is now enabled so /auth/login can set an
// HttpOnly Secure SameSite=Strict refresh-token cookie and
// /auth/refresh-token can read it. The primary auth for API calls
// is still JWT Bearer — only the refresh channel uses the cookie.
import cookieParser from 'cookie-parser';
import { config } from '@/config';
import { logger } from '@/config/logger';
import { errorHandler, notFoundHandler } from '@/middleware/errorHandler';
import { ScheduledReportsService } from '@/services/ScheduledReportsService';
import { generalRateLimit } from '@/middleware/rateLimiter';
import { performanceMonitoring, memoryMonitoring } from '@/middleware/performanceMonitoring';
import { defaultTimeout, extendedTimeout } from '@/middleware/requestTimeout';

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
import reportsRoutes from '@/routes/reports';
import enhancedAnalyticsRoutes from '@/routes/enhancedAnalytics';
import exportsRoutes from '@/routes/exports';
import auditLogsRoutes from '@/routes/audit-logs';
import formRoutes from '@/routes/forms';
import notificationRoutes from '@/routes/notifications';
import mobileRoutes from '@/routes/mobile';
import securityRoutes from '@/routes/security';
import deduplicationRoutes from '@/routes/deduplication';
import rateTypesRoutes from '@/routes/rate-types';
import rateTypeAssignmentsRoutes from '@/routes/rate-type-assignments';
import ratesRoutes from '@/routes/rates';
import serviceZoneRulesRoutes from '@/routes/service-zone-rules';
import healthRoutes from '@/routes/health';
import aiReportsRoutes from '@/routes/aiReports';
import verificationTasksRoutes from '@/routes/verificationTasks';
import templateReportsRoutes from '@/routes/templateReports';
import fieldMonitoringRoutes from '@/routes/fieldMonitoring';
import kycRoutes from '@/routes/kyc';
import caseDataTemplatesRoutes from '@/routes/caseDataTemplates';
import caseDataEntriesRoutes from '@/routes/caseDataEntries';

const app = express();

// Trust proxy for X-Forwarded-For headers from Nginx (specific to localhost)
app.set('trust proxy', ['127.0.0.1', '::1']);

// Security middleware — enterprise-grade headers
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"], // Required for inline styles (Tailwind)
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'", 'wss:', 'ws:', ...(config.corsOrigin || [])],
        fontSrc: ["'self'", 'data:'],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
        frameAncestors: ["'none'"],
        formAction: ["'self'"],
        baseUri: ["'self'"],
        upgradeInsecureRequests: config.nodeEnv === 'production' ? [] : null,
      },
    },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    hsts:
      config.nodeEnv === 'production'
        ? { maxAge: 31536000, includeSubDomains: true, preload: true }
        : false,
    noSniff: true,
    xssFilter: true,
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
      'Idempotency-Key',
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

// Gzip compression — reduces response size by 60-80% for JSON/text payloads
app.use(compression());

// Serve uploaded files (verification photos, attachments)
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Body parsing middleware — 5MB default for JSON (mobile file uploads use Multer multipart, not JSON body)
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
// Phase E5: parse cookies so the auth refresh flow can read the
// HttpOnly refresh-token cookie. Non-auth routes ignore it.
app.use(cookieParser());

// Input sanitization — strip XSS from request body and query strings
import { sanitizeInput } from '@/middleware/sanitize';
app.use(sanitizeInput);

// NOTE: CSRF protection is NOT needed for this API.
// All authentication uses JWT Bearer tokens in Authorization headers.
// CSRF attacks only affect cookie-based auth (where browser auto-attaches credentials).
// Bearer tokens must be explicitly attached by client JS — an attacker's cross-origin
// form/script cannot read or attach them. This is inherently CSRF-safe by design.
// See: https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html

// Convention: snake_case is used for PostgreSQL columns only. Every other
// layer — controllers, services, HTTP request bodies, HTTP response bodies,
// frontend, mobile — uses camelCase. Conversion from snake_case to camelCase
// happens at the pg pool boundary (src/config/db.ts + src/utils/rowTransform.ts)
// so query results reach controllers already camelized. Services that build
// response DTOs by hand MUST use camelCase keys directly.

// Performance monitoring — request timing + memory tracking
app.use(performanceMonitoring);
app.use(memoryMonitoring);

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

// ─── API Router ─────────────────────────────────────────────────────────────
// All API routes are registered on this router, then mounted at both
// /api (current) and /api/v1 (versioned) so clients can migrate gradually.
const apiRouter = express.Router();

// Request timeout — 30s default
apiRouter.use(defaultTimeout);

// Rate limiting
apiRouter.use(generalRateLimit);

// Health check routes (comprehensive monitoring)
apiRouter.use('/', healthRoutes);

// Core routes
apiRouter.use('/auth', authRoutes);
apiRouter.use('/cases', caseRoutes);
apiRouter.use('/clients', clientRoutes);
apiRouter.use('/clients', clientDocumentTypesRoutes);
apiRouter.use('/attachments', attachmentRoutes);
apiRouter.use('/user', userRoutes);
apiRouter.use('/users', usersRoutes);
apiRouter.use('/users', userTerritoryRoutes);
apiRouter.use('/territory-assignments', territoryAssignmentsRoutes);
apiRouter.use('/dashboard', dashboardRoutes);
apiRouter.use('/products', productsRoutes);
apiRouter.use('/verification-types', verificationTypesRoutes);
apiRouter.use('/document-types', documentTypesRoutes);
apiRouter.use('/document-type-rates', documentTypeRatesRoutes);
apiRouter.use('/invoices', invoicesRoutes);
apiRouter.use('/commissions', commissionsRoutes);
apiRouter.use('/commission-management', commissionManagementRoutes);
apiRouter.use('/cities', citiesRoutes);
apiRouter.use('/states', statesRoutes);
apiRouter.use('/countries', countriesRoutes);
apiRouter.use('/pincodes', pincodesRoutes);
apiRouter.use('/areas', areasRoutes);
apiRouter.use('/roles', rolesRoutes);
apiRouter.use('/rbac', rbacRoutes);
apiRouter.use('/permissions', rbacRoutes);
apiRouter.use('/departments', departmentsRoutes);
apiRouter.use('/designations', designationsRoutes);

// Extended timeout (2min) for heavy report/export operations
apiRouter.use('/reports', extendedTimeout, reportsRoutes);
apiRouter.use('/enhanced-analytics', extendedTimeout, enhancedAnalyticsRoutes);
apiRouter.use('/exports', extendedTimeout, exportsRoutes);
apiRouter.use('/audit-logs', auditLogsRoutes);
apiRouter.use('/forms', formRoutes);
apiRouter.use('/notifications', notificationRoutes);
apiRouter.use('/security', securityRoutes);
apiRouter.use('/cases/deduplication', deduplicationRoutes);
apiRouter.use('/rate-types', rateTypesRoutes);
apiRouter.use('/rate-type-assignments', rateTypeAssignmentsRoutes);
apiRouter.use('/rates', ratesRoutes);
apiRouter.use('/service-zone-rules', serviceZoneRulesRoutes);
apiRouter.use('/ai-reports', extendedTimeout, aiReportsRoutes);
apiRouter.use('/template-reports', extendedTimeout, templateReportsRoutes);
apiRouter.use('/field-monitoring', fieldMonitoringRoutes);
apiRouter.use('/kyc', kycRoutes);
apiRouter.use('/case-data-templates', caseDataTemplatesRoutes);
apiRouter.use('/case-data-entries', caseDataEntriesRoutes);

// Multi-verification task routes
apiRouter.use('/', verificationTasksRoutes);

// Mobile API routes — extended timeout for slow networks + larger JSON body for mobile sync
apiRouter.use('/mobile', extendedTimeout, express.json({ limit: '50mb' }), mobileRoutes);

// Mount the API router at both /api (backward compat) and /api/v1 (versioned)
app.use('/api', apiRouter);
app.use('/api/v1', apiRouter);

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
