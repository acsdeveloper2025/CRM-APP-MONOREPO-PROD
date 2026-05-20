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

/**
 * Process role — split the same image into independently scalable
 * processes for the Docker migration (PR2). Default 'all' preserves
 * today's PM2 fork behaviour byte-for-byte; containerized deploys
 * override via ROLE env to api OR worker.
 *
 *   ROLE=api     → HTTP + Socket.IO; no BullMQ workers, no DB-maintenance.
 *   ROLE=worker  → BullMQ workers + interval jobs; no HTTP listener.
 *   ROLE=all     → everything (current behaviour).
 *
 * Anything else (unset, typo, empty) falls open to 'all' rather than
 * crash-looping the container on a misconfigured env var.
 */
const resolveRole = (): 'api' | 'worker' | 'all' => {
  const raw = (process.env.ROLE || '').trim().toLowerCase();
  if (raw === 'api' || raw === 'worker' || raw === 'all') {
    return raw;
  }
  if (raw !== '') {
    process.stderr.write(`Unknown ROLE env value "${raw}", defaulting to "all".\n`);
  }
  return 'all';
};

const resolveWorkerHealthPort = (): number => {
  const raw = process.env.WORKER_HEALTH_PORT;
  if (!raw) {
    return 3001;
  }
  const parsed = parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 65535) {
    process.stderr.write(`Invalid WORKER_HEALTH_PORT env var: "${raw}". Falling back to 3001.\n`);
    return 3001;
  }
  return parsed;
};

export const config = {
  // Server — port resolved from PORT env var (defaults to 3000 in dev)
  port: resolvedPort,
  nodeEnv,

  // PR2 (Docker migration): which slice of the process this instance runs.
  role: resolveRole(),
  workerHealthPort: resolveWorkerHealthPort(),

  // Database
  databaseUrl: requireEnv('DATABASE_URL'),

  // JWT — fail fast if missing so types stay narrow downstream and we
  // never silently fall through to an empty/undefined signing secret.
  jwtSecret: requireEnv('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
  jwtRefreshSecret: requireEnv('JWT_REFRESH_SECRET'),
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  // NEW-HIGH-2 (AUDIT 2026-05-17): optional fallback secrets to enable
  // zero-downtime rotation. During rotation: deploy with NEW + OLD set
  // for 24h (longer than access TTL), then remove OLD. Tokens signed
  // with the OLD secret still verify; new tokens sign with NEW only.
  // See utils/jwtRotation.ts for the verify-with-fallback helper.
  oldJwtSecret: process.env.OLD_JWT_SECRET || undefined,
  oldJwtRefreshSecret: process.env.OLD_JWT_REFRESH_SECRET || undefined,

  // Redis. REDIS_PASSWORD is optional — many environments (incl. local dev
  // server, Docker compose with bridge-isolated Redis, ElastiCache with IAM)
  // run Redis without an AUTH password. The actual connection layer at
  // src/config/redis.ts maps empty/undefined to `undefined` for ioredis,
  // which then skips the AUTH command. Don't fail-fast here — that broke
  // pm2 boot on the dev server (REDIS_URL=redis://localhost:6379, no auth).
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  redisPassword: process.env.REDIS_PASSWORD || '',

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

  // T1-1 (audit 2026-05-17): audit-log tamper-evidence.
  // HMAC secret used to sign every audit_logs row's hash chain.
  // - In production: REQUIRED. Missing => fail-fast at boot so we never
  //   silently emit unsigned rows that would break the chain.
  // - In dev: defaults to a stable string so devs do not need to set
  //   the env to boot the server. Rotation of this secret invalidates
  //   the existing chain (verifier will report break) — rotate only
  //   alongside a documented "chain restart" event with prior signed
  //   archive captured first.
  auditLogHmacSecret: (() => {
    const secret = process.env.AUDIT_LOG_HMAC_SECRET;
    if (!secret && process.env.NODE_ENV === 'production') {
      throw new Error('AUDIT_LOG_HMAC_SECRET environment variable is required in production');
    }
    return secret || 'dev-only-audit-log-hmac-secret';
  })(),

  // T1-2 (audit 2026-05-17): MFA TOTP secret encryption key.
  // 32-byte AES-256-GCM key, base64-encoded. Used to encrypt/decrypt
  // `user_mfa_secrets.secret_encrypted`. Rotation: requires a re-enroll
  // sweep — every existing user has to re-enroll because we cannot
  // decrypt the old ciphertext with the new key. Do not rotate without
  // a documented user-comms + grace-window plan.
  mfaEncryptionKey: (() => {
    const raw = process.env.MFA_ENCRYPTION_KEY;
    if (!raw && process.env.NODE_ENV === 'production') {
      throw new Error('MFA_ENCRYPTION_KEY environment variable is required in production');
    }
    const b64 = raw || 'ZGV2LW9ubHktbWZhLWtleS0zMmJ5dGUtcGxhY2Vob2xkZXJfXw=='; // dev only
    const key = Buffer.from(b64, 'base64');
    if (key.length !== 32) {
      throw new Error(
        `MFA_ENCRYPTION_KEY must decode to exactly 32 bytes; got ${key.length}. ` +
          "Generate with: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\""
      );
    }
    return key;
  })(),

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

  // GST (Indian tax) — supplier identity + default rate.
  //
  // SUPPLIER_GST_STATE_CODE: 2-digit GST state code of ACS's registered
  // GSTIN. Used to derive INTRA_STATE vs INTER_STATE for every invoice
  // (matches recipient `clients.gstin_state_code` → intra → CGST+SGST;
  // differs → inter → IGST). When unset, invoice generation fails LOUD
  // with a config error — there's no safe legacy fallback (legacy
  // `tax_amount`-only mode is intentionally disabled once GST split logic
  // is wired, per ops decision 2026-05-11).
  //
  // GST_RATE_DEFAULT: flat rate in percent (e.g. `18` for 18%). Applied to
  // every line item's subtotal. Per-service rates (SAC variation) are not
  // supported today — single rate is the deliberate design choice (B1).
  gst: {
    supplierStateCode: process.env.SUPPLIER_GST_STATE_CODE || '',
    rateDefault: (() => {
      const raw = process.env.GST_RATE_DEFAULT;
      if (!raw || raw.trim() === '') {
        return 18;
      }
      const parsed = Number(raw);
      if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
        process.stderr.write(`Invalid GST_RATE_DEFAULT env var: "${raw}". Falling back to 18.\n`);
        return 18;
      }
      return parsed;
    })(),
  },
};

// DATABASE_URL / JWT_SECRET / JWT_REFRESH_SECRET are now validated inline
// via requireEnv() at config build time, so no separate post-config check
// is needed. REDIS_PASSWORD is fail-fast in production via the conditional
// requireEnv on the redisPassword field.
