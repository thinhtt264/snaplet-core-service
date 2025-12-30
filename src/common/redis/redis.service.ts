import { Injectable, Inject, OnModuleDestroy, Logger } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private isAvailable: boolean = true;

  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {
    // Monitor connection status
    this.redis.on('ready', () => {
      this.isAvailable = true;
      this.logger.log('Redis connected successfully');
    });

    this.redis.on('error', () => {
      this.isAvailable = false;
    });

    this.redis.on('close', () => {
      this.isAvailable = false;
    });

    // Check initial connection status
    this.checkAvailability();
  }

  /**
   * Check if Redis is available
   */
  private async checkAvailability(): Promise<void> {
    try {
      const status = this.redis.status;
      this.isAvailable = status === 'ready' || status === 'connect';
    } catch {
      this.isAvailable = false;
    }
  }

  /**
   * Safe execute Redis command with error handling
   * Automatically checks Redis availability before executing
   */
  private async safeExecute<T>(
    operation: () => Promise<T>,
    defaultValue: T,
    operationName: string,
  ): Promise<T> {
    // Check if Redis is available before executing
    if (!this.isRedisAvailable()) {
      return defaultValue;
    }

    try {
      return await operation();
    } catch (error) {
      this.logger.warn(
        `Redis operation "${operationName}" failed (returning default): ${error.message}`,
      );
      this.isAvailable = false;
      return defaultValue;
    }
  }

  /**
   * Get value by key
   * Returns null if Redis is unavailable
   */
  async get(key: string): Promise<string | null> {
    return this.safeExecute(() => this.redis.get(key), null, 'get');
  }

  /**
   * Set key-value with optional expiration (in seconds)
   * Returns null if Redis is unavailable
   */
  async set(
    key: string,
    value: string,
    expirationSeconds?: number,
  ): Promise<'OK' | null> {
    return this.safeExecute(
      async () => {
        if (expirationSeconds) {
          return this.redis.set(key, value, 'EX', expirationSeconds);
        }
        return this.redis.set(key, value);
      },
      null,
      'set',
    );
  }

  /**
   * Set key-value only if key does not exist (atomic operation)
   * Returns 'OK' if set successfully, null if key already exists or Redis unavailable
   * @param key Redis key
   * @param value Value to set
   * @param expirationSeconds Optional expiration in seconds
   */
  async setIfNotExists(
    key: string,
    value: string,
    expirationSeconds?: number,
  ): Promise<'OK' | null> {
    return this.safeExecute(
      async () => {
        if (expirationSeconds) {
          return this.redis.set(key, value, 'EX', expirationSeconds, 'NX');
        }
        return this.redis.set(key, value, 'NX');
      },
      null,
      'setIfNotExists',
    );
  }

  /**
   * Delete key(s)
   * Returns 0 if Redis is unavailable
   */
  async del(key: string | string[]): Promise<number> {
    return this.safeExecute(
      async () => {
        if (Array.isArray(key)) {
          return this.redis.del(...key);
        }
        return this.redis.del(key);
      },
      0,
      'del',
    );
  }

  /**
   * Check if key exists
   * Returns 0 if Redis is unavailable
   */
  async exists(key: string): Promise<number> {
    return this.safeExecute(() => this.redis.exists(key), 0, 'exists');
  }

  /**
   * Set expiration for a key (in seconds)
   * Returns 0 if Redis is unavailable
   */
  async expire(key: string, seconds: number): Promise<number> {
    return this.safeExecute(() => this.redis.expire(key, seconds), 0, 'expire');
  }

  /**
   * Get TTL (time to live) of a key in seconds
   * Returns -2 if Redis is unavailable (key doesn't exist)
   */
  async ttl(key: string): Promise<number> {
    return this.safeExecute(() => this.redis.ttl(key), -2, 'ttl');
  }

  /**
   * Increment value by key
   * Returns 0 if Redis is unavailable
   */
  async incr(key: string): Promise<number> {
    return this.safeExecute(() => this.redis.incr(key), 0, 'incr');
  }

  /**
   * Get Redis client instance (for advanced operations)
   * Note: May be unavailable if Redis connection is down
   */
  getClient(): Redis {
    return this.redis;
  }

  /**
   * Check if Redis is currently available
   */
  isRedisAvailable(): boolean {
    return this.isAvailable && this.redis.status === 'ready';
  }

  /**
   * Close Redis connection
   */
  async onModuleDestroy(): Promise<void> {
    try {
      if (this.redis.status !== 'end') {
        await this.redis.quit();
      }
    } catch (error) {
      this.logger.warn(`Error closing Redis connection: ${error.message}`);
    }
  }
}
