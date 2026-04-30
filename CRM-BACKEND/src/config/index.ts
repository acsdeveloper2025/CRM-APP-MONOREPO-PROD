import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Resolve the HTTP port from the environment.
// Defaults to 3000 for local dev. Any positive integer is accepted so the
// service can be deployed behind platforms that inject a dynamic PORT
// (Render, Fly, Heroku, Cloud Run, etc.).
const resolvePort = (): number => {
  const raw = process.env.PORT;
  if (!raw) {
    return 3000;
  }
  const parsed = parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 65535) {
    process.stderr.write(`Invalid PORT env var: "${raw}". Falling back to 3000.\n`);
    return 3000;
  }
  return parsed;
};

const resolvedPort = resolvePort();

/**
 * Read a required environment variable. Throws at module load if it
 * is not set so downstream code can rely on `string` rather than
 * `string | undefined`.
 */
const requireEnv = (name: string): string => {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(`Required environment variable ${name} is not set`);
  }
  return value;
};

const nodeEnv = process.env.NODE_ENV || 'development';

export const config = {
  // Server — port resolved from PORT env var (defaults to 3000 in dev)
  port: resolvedPort,
  nodeEnv,

  // Database
  databaseUrl: requireEnv('DATABASE_URL'),

  // JWT — fail fast if missing so types stay narrow downstream and we
  // never silently fall through to an empty/undefined signing secret.
  jwtSecret: requireEnv('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
  jwtRefreshSecret: requireEnv('JWT_REFRESH_SECRET'),
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',

  // Redis
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  redisPassword:
    nodeEnv === 'production' ? requireEnv('REDIS_PASSWORD') : process.env.REDIS_PASSWORD || '',

  // Firebase Cloud Messaging (FCM)
  firebase: {
    serviceAccountJson: process.env.FIREBASE_SERVICE_ACCOUNT_JSON,
    serviceAccountBase64: process.env.FIREBASE_SERVICE_ACCOUNT_BASE64,
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

  // CORS - Support both web app and mobile app with configurable origins
  corsOrigin: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
    : ['http://localhost:5173', 'http://localhost:5180'],

  // Rate Limiting - Very generous limits for field agents processing 100+ cases/day
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
  rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '5000', 10), // Increased from 500 to 5000 for high-volume operations

  // File Upload - ONLY images, PDF, and Word documents
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '52428800', 10), // 50MB (increased for mobile app with multiple images)
  uploadPath: process.env.UPLOAD_PATH || './uploads',

  // Storage backend (F7.11.2 + F8.2.3)
  // - 'local': default, files on local FS (dev + small prod)
  // - 's3':    AWS S3 / Cloudflare R2 / MinIO (any S3-compatible). Production target.
  storage: {
    backend: (process.env.STORAGE_BACKEND || 'local') as 'local' | 's3',
    bucket: process.env.STORAGE_BUCKET || '',
    endpoint: process.env.STORAGE_ENDPOINT || '', // optional; e.g. https://s3.ap-south-1.amazonaws.com or MinIO URL
    region: process.env.STORAGE_REGION || 'ap-south-1',
    accessKey: process.env.STORAGE_ACCESS_KEY || '',
    secretKey: process.env.STORAGE_SECRET_KEY || '',
    forcePathStyle: process.env.STORAGE_FORCE_PATH_STYLE === 'true', // true for MinIO, false for AWS
    // Signed-URL TTLs
    readUrlTtlSeconds: parseInt(process.env.STORAGE_READ_URL_TTL || '900', 10), // 15 min
    writeUrlTtlSeconds: parseInt(process.env.STORAGE_WRITE_URL_TTL || '300', 10), // 5 min
  },

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
  wsCorsOrigin: process.env.WS_CORS_ORIGIN
    ? process.env.WS_CORS_ORIGIN.split(',').map((o: string) => o.trim())
    : process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',').map((o: string) => o.trim())
      : ['http://localhost:5173', 'http://localhost:5180'],
  wsHeartbeatInterval: parseInt(process.env.WS_HEARTBEAT_INTERVAL || '30000', 10),
  wsConnectionTimeout: parseInt(process.env.WS_CONNECTION_TIMEOUT || '60000', 10),

  // Security
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
  sessionSecret: (() => {
    const secret = process.env.SESSION_SECRET;
    if (!secret && process.env.NODE_ENV === 'production') {
      throw new Error('SESSION_SECRET environment variable is required in production');
    }
    return secret || 'dev-only-session-secret';
  })(),

  // Email
  smtpHost: process.env.SMTP_HOST || '',
  smtpPort: parseInt(process.env.SMTP_PORT || '587', 10),
  smtpUser: process.env.SMTP_USER || '',
  smtpPass: process.env.SMTP_PASS || '',

  // QR Code
  qrCodeBaseUrl: process.env.QR_CODE_BASE_URL || 'https://example.com/verify',

  // Background Jobs
  queueRedisUrl: process.env.QUEUE_REDIS_URL || 'redis://localhost:6379',
  queueConcurrency: parseInt(process.env.QUEUE_CONCURRENCY || '5', 10),

  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',

  // Mobile App Configuration
  mobile: {
    apiVersion: process.env.MOBILE_API_VERSION || '1.0.0',
    minSupportedVersion: process.env.MOBILE_MIN_SUPPORTED_VERSION || '1.0.0',
    forceUpdateVersion: process.env.MOBILE_FORCE_UPDATE_VERSION || '1.0.0',

    // Mobile Authentication
    jwtExpiresIn: process.env.MOBILE_JWT_EXPIRES_IN || '24h',
    refreshTokenExpiresIn: process.env.MOBILE_REFRESH_TOKEN_EXPIRES_IN || '30d',
    deviceTokenExpiresIn: process.env.DEVICE_TOKEN_EXPIRES_IN || '365d',

    // Mobile File Upload
    maxFileSize: parseInt(process.env.MOBILE_MAX_FILE_SIZE || '52428800', 10), // 50MB (increased for forms with multiple high-res images)
    maxFilesPerCase: parseInt(process.env.MOBILE_MAX_FILES_PER_CASE || '20', 10), // Increased to 20 files
    maxAttachmentUploadCount: parseInt(process.env.MOBILE_MAX_ATTACHMENT_UPLOAD_COUNT || '10', 10),
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
    locationAccuracyThreshold: parseInt(
      process.env.MOBILE_LOCATION_ACCURACY_THRESHOLD || '100',
      10
    ),
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
    // Phase E4: enableBiometricAuth removed — the flag was set for
    // months but the mobile client never implemented biometric auth.
    // If/when that feature lands, reintroduce the flag behind a real
    // implementation instead of advertising a security property that
    // does not exist.
    enableDarkMode: process.env.MOBILE_ENABLE_DARK_MODE === 'true',
    enableAnalytics: process.env.MOBILE_ENABLE_ANALYTICS === 'true',

    // Phase E1: SSL pinning kill switch.
    //
    // `pinningEnabled` — when false the mobile app falls back to
    //   standard TLS without pinning. Flip to false ONLY as an
    //   emergency escape hatch for a rotated cert that slipped
    //   through the overlap window.
    //
    // `pinSha256s` — comma-separated SHA256 fingerprints of the
    //   public keys (NOT the certs — public keys survive renewal
    //   when the same private key is reused). Set both the current
    //   and the next rotation value in one env for overlap.
    pinningEnabled: process.env.MOBILE_PINNING_ENABLED !== 'false',
    pinSha256s: (process.env.MOBILE_PIN_SHA256S || '')
      .split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0),
  },
};

// DATABASE_URL / JWT_SECRET / JWT_REFRESH_SECRET are now validated inline
// via requireEnv() at config build time, so no separate post-config check
// is needed. REDIS_PASSWORD is fail-fast in production via the conditional
// requireEnv on the redisPassword field.
