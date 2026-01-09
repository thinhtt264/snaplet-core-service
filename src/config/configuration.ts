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
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0', 10),
    cacheVersion: process.env.REDIS_CACHE_VERSION || 'v1',
  },

  auth: {
    deviceRegistrationLimit: {
      enabled: process.env.DEVICE_REGISTRATION_LIMIT_ENABLED !== 'false', // default: true
      ttlHours: parseFloat(process.env.DEVICE_REGISTRATION_TTL_HOURS || '24'), // default: 24h (supports decimal values like 0.1)
    },
  },
});
