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

  /** Add member(s) to a Redis set. */
  async sadd(key: string, ...members: string[]): Promise<number> {
    if (members.length === 0) return 0;
    return this.safeExecute(() => this.redis.sadd(key, ...members), 0, 'sadd');
  }

  /** Return all members of a Redis set. */
  async smembers(key: string): Promise<string[]> {
    return this.safeExecute(() => this.redis.smembers(key), [], 'smembers');
  }

  /**
   * Scan and return keys matching a pattern.
   */
  async scanKeys(pattern: string): Promise<string[]> {
    return this.safeExecute(
      async () => {
        const keys: string[] = [];
        let cursor = '0';

        do {
          const [nextCursor, batch] = await this.redis.scan(
            cursor,
            'MATCH',
            pattern,
            'COUNT',
            100,
          );
          cursor = nextCursor;
          if (batch.length) {
            keys.push(...batch);
          }
        } while (cursor !== '0');

        return keys;
      },
      [],
      'scanKeys',
    );
  }

  /**
   * Delete all keys matching a pattern.
   */
  async deleteByPattern(pattern: string): Promise<number> {
    return this.safeExecute(
      async () => {
        const keys = await this.scanKeys(pattern);
        if (!keys.length) {
          return 0;
        }
        return this.del(keys);
      },
      0,
      'deleteByPattern',
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
   * Decrement value by key.
   * Returns 0 if Redis is unavailable.
   */
  async decr(key: string): Promise<number> {
    return this.safeExecute(() => this.redis.decr(key), 0, 'decr');
  }

  /**
   * Get hash field value.
   * Returns null if Redis is unavailable or field doesn't exist.
   */
  async hget(key: string, field: string): Promise<string | null> {
    return this.safeExecute(() => this.redis.hget(key, field), null, 'hget');
  }

  /**
   * Set hash field value.
   * Returns 0 if Redis is unavailable.
   */
  async hset(key: string, field: string, value: string): Promise<number> {
    return this.safeExecute(
      () => this.redis.hset(key, field, value),
      0,
      'hset',
    );
  }

  /**
   * Increment hash field by value.
   * Returns 0 if Redis is unavailable.
   */
  async hincrby(
    key: string,
    field: string,
    increment: number,
  ): Promise<number> {
    return this.safeExecute(
      () => this.redis.hincrby(key, field, increment),
      0,
      'hincrby',
    );
  }

  /**
   * Execute a Redis multi block with shared safeExecute handling.
   * The callback is responsible for building commands and calling `exec()`.
   */
  async multiExec<T>(
    operation: (multi: ReturnType<Redis['multi']>) => Promise<T>,
    defaultValue: T,
    operationName: string,
  ): Promise<T> {
    return this.safeExecute(
      async () => operation(this.redis.multi()),
      defaultValue,
      operationName,
    );
  }

  /**
   * Fetch multiple keys in a single round-trip (Redis MGET).
   * Returns an array aligned with `keys`: null for each miss or unavailable Redis.
   */
  async mget(keys: string[]): Promise<(string | null)[]> {
    if (!keys.length) return [];
    return this.safeExecute(
      () => this.redis.mget(...keys),
      keys.map(() => null),
      'mget',
    );
  }

  /**
   * Set multiple key-value pairs with individual TTLs in a single pipeline round-trip.
   */
  async mset(
    entries: Array<{ key: string; value: string; ttlSeconds: number }>,
  ): Promise<void> {
    if (!entries.length) return;
    await this.safeExecute(
      async () => {
        const pipeline = this.redis.pipeline();
        for (const { key, value, ttlSeconds } of entries) {
          pipeline.set(key, value, 'EX', ttlSeconds);
        }
        await pipeline.exec();
      },
      undefined,
      'mset',
    );
  }

  async multiSetWithExpire(
    entries: Array<{
      key: string;
      value: string;
      expirationSeconds: number;
    }>,
  ): Promise<void> {
    if (!entries.length) return;

    await this.safeExecute(
      async () => {
        const multi = this.redis.multi();
        for (const entry of entries) {
          multi.set(entry.key, entry.value, 'EX', entry.expirationSeconds);
        }
        await multi.exec();
      },
      undefined,
      'multiSetWithExpire',
    );
  }

  async multiIncrWithExpire(
    entries: Array<{
      key: string;
      expirationSeconds: number;
    }>,
  ): Promise<number[]> {
    if (!entries.length) return [];

    return this.safeExecute(
      async () => {
        const multi = this.redis.multi();
        for (const entry of entries) {
          multi.incr(entry.key);
          multi.expire(entry.key, entry.expirationSeconds);
        }
        const results = await multi.exec();
        if (!results) {
          return entries.map(() => 0);
        }

        // Với mỗi entry ta có 2 lệnh (incr, expire) → lấy kết quả ở các index chẵn
        const values: number[] = [];
        for (let i = 0; i < results.length; i += 2) {
          values.push(Number(results[i]?.[1] ?? 0));
        }
        return values;
      },
      entries.map(() => 0),
      'multiIncrWithExpire',
    );
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
