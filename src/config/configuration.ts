const COMMON_CACHE_TTL_SECONDS = 14 * 24 * 60 * 60; // 14 days

export default () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  apiPrefix: process.env.API_PREFIX || '',

  database: {
    uri: process.env.MONGODB_URI || '',
    user: process.env.MONGODB_USER || '',
    password: process.env.MONGODB_PASSWORD || '',
  },

  jwt: {
    secret: process.env.JWT_SECRET || '',
    expiresIn: process.env.JWT_EXPIRATION || '5m', // Access token expiration
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRATION || '30d', // Refresh token expiration
  },

  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:4040'],
  },

  throttle: {
    ttl: parseInt(process.env.THROTTLE_TTL || '90', 10),
    limit: parseInt(process.env.THROTTLE_LIMIT || '5', 10),
  },

  logging: {
    level: process.env.LOG_LEVEL || 'debug',
  },

  redis: {
    uri: process.env.REDIS_URL || undefined,
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    cacheVersion: process.env.REDIS_CACHE_VERSION || 'v1',
  },

  auth: {
    deviceRegistrationLimit: {
      enabled: process.env.DEVICE_REGISTRATION_LIMIT_ENABLED !== 'false', // default: true
      ttlHours: parseFloat(process.env.DEVICE_REGISTRATION_TTL_HOURS || '24'), // default: 24h (supports decimal values like 0.1)
    },
  },

  media: {
    cleanup: {
      olderThanHours: parseFloat(
        process.env.MEDIA_CLEANUP_OLDER_THAN_HOURS || '24',
      ), // default: 24h (1 day)
    },
  },

  relationships: {
    cache: {
      ttlSeconds: parseInt(
        process.env.RELATIONSHIPS_CACHE_TTL_SECONDS ||
          COMMON_CACHE_TTL_SECONDS.toString(),
        10,
      ),
    },
  },

  /**
   * BullMQ Worker (posts-unread): defaults favor fewer Redis round-trips when idle.
   * drainDelay: seconds between empty-queue polls. lockDuration / stalledInterval: ms.
   */
  postsUnread: {
    worker: {
      drainDelaySeconds: parseInt(
        process.env.POSTS_UNREAD_WORKER_DRAIN_DELAY_SECONDS || String(5 * 60), // 5 minutes
        30,
      ),
      lockDurationMs: parseInt(
        process.env.POSTS_UNREAD_WORKER_LOCK_DURATION_MS || String(20 * 1000), // 20 seconds
        30,
      ),
      stalledIntervalMs: parseInt(
        process.env.POSTS_UNREAD_WORKER_STALLED_INTERVAL_MS ||
          String(10 * 1000), // 10 seconds
        15,
      ),
    },
  },

  r2: {
    accountId: process.env.R2_ACCOUNT_ID || '',
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
    bucket: process.env.R2_BUCKET || '',
    publicUrl: process.env.R2_PUBLIC_URL || '',
    presignedUrlExpiresIn: parseInt(
      process.env.R2_PRESIGNED_URL_EXPIRES_IN || '900',
      10,
    ), // default: 15 minutes (900 seconds)
  },

  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID || '',
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL || '',
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n') || '',
  },

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
  },

  /**
   * BullMQ Worker (notification push): same tuning idea as posts-unread.
   */
  notifications: {
    worker: {
      drainDelaySeconds: parseInt(
        process.env.NOTIFICATIONS_WORKER_DRAIN_DELAY_SECONDS || String(5 * 60),
        10,
      ),
      lockDurationMs: parseInt(
        process.env.NOTIFICATIONS_WORKER_LOCK_DURATION_MS || String(20 * 1000),
        10,
      ),
      stalledIntervalMs: parseInt(
        process.env.NOTIFICATIONS_WORKER_STALLED_INTERVAL_MS ||
          String(10 * 1000),
        10,
      ),
    },
  },
});
