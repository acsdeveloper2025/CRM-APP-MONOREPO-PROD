import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Validate that we're using the correct fixed ports
const validatePorts = () => {
  const requiredPort = 3000;
  const configuredPort = parseInt(process.env.PORT || '3000', 10);

  if (configuredPort !== requiredPort) {
    console.error(`❌ Port mismatch: Backend must run on port ${requiredPort}, but PORT=${configuredPort} was configured.`);
    console.error(`   Please update your environment to use PORT=${requiredPort} or remove the PORT environment variable.`);
    process.exit(1);
  }
};

// Run port validation
validatePorts();

export const config = {
  // Server - Fixed port 3000 (no automatic switching)
  port: 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Database
  databaseUrl: process.env.DATABASE_URL || '',
  
  // JWT
  jwtSecret: process.env.JWT_SECRET || 'fallback-secret-change-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  
  // Redis
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  redisPassword: process.env.REDIS_PASSWORD || '',

  // Firebase Cloud Messaging (FCM)
  firebase: {
    serviceAccountPath: process.env.FIREBASE_SERVICE_ACCOUNT_PATH,
    projectId: process.env.FIREBASE_PROJECT_ID,
  },

  // Apple Push Notification Service (APNS)
  apns: {
    keyPath: process.env.APNS_KEY_PATH,
    keyId: process.env.APNS_KEY_ID,
    teamId: process.env.APNS_TEAM_ID,
    bundleId: process.env.APNS_BUNDLE_ID || 'com.example.crm',
  },
  
  // CORS - Support both web app (5173) and mobile app (5174)
  corsOrigin: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
    : ['http://localhost:5173', 'http://localhost:5174'],
  
  // Rate Limiting - Very generous limits for field agents processing 100+ cases/day
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
  rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '5000', 10), // Increased from 500 to 5000 for high-volume operations
  
  // File Upload - ONLY images, PDF, and Word documents
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10), // 10MB
  uploadPath: process.env.UPLOAD_PATH || './uploads',
  allowedFileTypes: process.env.ALLOWED_FILE_TYPES?.split(',') || [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/bmp',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
  
  // Geolocation
  googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || '',
  maxLocationAccuracy: parseInt(process.env.MAX_LOCATION_ACCURACY || '100', 10),
  
  // Push Notifications
  fcmServerKey: process.env.FCM_SERVER_KEY || '',
  apnsKeyId: process.env.APNS_KEY_ID || '',
  apnsTeamId: process.env.APNS_TEAM_ID || '',
  
  // WebSocket
  wsPort: parseInt(process.env.WS_PORT || '3000', 10),
  wsCorsOrigin: process.env.WS_CORS_ORIGIN || '*',
  wsHeartbeatInterval: parseInt(process.env.WS_HEARTBEAT_INTERVAL || '30000', 10),
  wsConnectionTimeout: parseInt(process.env.WS_CONNECTION_TIMEOUT || '60000', 10),
  
  // Security
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
  sessionSecret: process.env.SESSION_SECRET || 'fallback-session-secret',
  
  // Email
  smtpHost: process.env.SMTP_HOST || '',
  smtpPort: parseInt(process.env.SMTP_PORT || '587', 10),
  smtpUser: process.env.SMTP_USER || '',
  smtpPass: process.env.SMTP_PASS || '',
  
  // QR Code
  qrCodeBaseUrl: process.env.QR_CODE_BASE_URL || 'https://localhost:3000/verify',
  
  // Background Jobs
  queueRedisUrl: process.env.QUEUE_REDIS_URL || 'redis://localhost:6379',
  queueConcurrency: parseInt(process.env.QUEUE_CONCURRENCY || '5', 10),
  
  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',

  // Mobile App Configuration
  mobile: {
    apiVersion: process.env.MOBILE_API_VERSION || '4.0.0',
    minSupportedVersion: process.env.MOBILE_MIN_SUPPORTED_VERSION || '0.0.0',
    forceUpdateVersion: process.env.MOBILE_FORCE_UPDATE_VERSION || '0.0.0',

    // Mobile Authentication
    jwtExpiresIn: process.env.MOBILE_JWT_EXPIRES_IN || '24h',
    refreshTokenExpiresIn: process.env.MOBILE_REFRESH_TOKEN_EXPIRES_IN || '30d',
    deviceTokenExpiresIn: process.env.DEVICE_TOKEN_EXPIRES_IN || '365d',

    // Mobile File Upload
    maxFileSize: parseInt(process.env.MOBILE_MAX_FILE_SIZE || '10485760', 10),
    maxFilesPerCase: parseInt(process.env.MOBILE_MAX_FILES_PER_CASE || '15', 10),
    allowedImageTypes: process.env.MOBILE_ALLOWED_IMAGE_TYPES?.split(',') || [
      'image/jpeg',
      'image/png',
      'image/heic',
    ],
    allowedDocumentTypes: process.env.MOBILE_ALLOWED_DOCUMENT_TYPES?.split(',') || [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],

    // Mobile Location Services
    locationAccuracyThreshold: parseInt(process.env.MOBILE_LOCATION_ACCURACY_THRESHOLD || '10', 10),
    locationTimeout: parseInt(process.env.MOBILE_LOCATION_TIMEOUT || '30000', 10),
    enableLocationValidation: process.env.MOBILE_ENABLE_LOCATION_VALIDATION === 'true',
    reverseGeocodingEnabled: process.env.MOBILE_REVERSE_GEOCODING_ENABLED === 'true',

    // Mobile Offline Sync
    syncBatchSize: parseInt(process.env.MOBILE_SYNC_BATCH_SIZE || '50', 10),
    syncRetryAttempts: parseInt(process.env.MOBILE_SYNC_RETRY_ATTEMPTS || '3', 10),
    syncRetryDelay: parseInt(process.env.MOBILE_SYNC_RETRY_DELAY || '5000', 10),
    offlineDataRetentionDays: parseInt(process.env.MOBILE_OFFLINE_DATA_RETENTION_DAYS || '30', 10),

    // Mobile Push Notifications
    fcmEnabled: process.env.MOBILE_FCM_ENABLED === 'true',
    apnsEnabled: process.env.MOBILE_APNS_ENABLED === 'true',
    notificationBatchSize: parseInt(process.env.MOBILE_NOTIFICATION_BATCH_SIZE || '100', 10),

    // Mobile Real-time Updates
    wsEnabled: process.env.MOBILE_WS_ENABLED === 'true',
    wsReconnectAttempts: parseInt(process.env.MOBILE_WS_RECONNECT_ATTEMPTS || '5', 10),
    wsReconnectDelay: parseInt(process.env.MOBILE_WS_RECONNECT_DELAY || '3000', 10),

    // Mobile Security
    enableDeviceBinding: process.env.MOBILE_ENABLE_DEVICE_BINDING === 'true',
    maxDevicesPerUser: parseInt(process.env.MOBILE_MAX_DEVICES_PER_USER || '3', 10),
    deviceVerificationRequired: process.env.MOBILE_DEVICE_VERIFICATION_REQUIRED === 'true',

    // Mobile Performance
    apiCacheTtl: parseInt(process.env.MOBILE_API_CACHE_TTL || '300', 10),
    imageCompressionQuality: parseFloat(process.env.MOBILE_IMAGE_COMPRESSION_QUALITY || '0.8'),
    thumbnailSize: parseInt(process.env.MOBILE_THUMBNAIL_SIZE || '200', 10),

    // Mobile Feature Flags
    enableOfflineMode: process.env.MOBILE_ENABLE_OFFLINE_MODE === 'true',
    enableBackgroundSync: process.env.MOBILE_ENABLE_BACKGROUND_SYNC === 'true',
    enableBiometricAuth: process.env.MOBILE_ENABLE_BIOMETRIC_AUTH === 'true',
    enableDarkMode: process.env.MOBILE_ENABLE_DARK_MODE === 'true',
    enableAnalytics: process.env.MOBILE_ENABLE_ANALYTICS === 'true',
  },
};

// Validate required environment variables
const requiredEnvVars = ['DATABASE_URL', 'JWT_SECRET'];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Required environment variable ${envVar} is not set`);
  }
}
