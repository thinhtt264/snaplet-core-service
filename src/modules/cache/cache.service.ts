import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '@common/redis/redis.service';
import { buildRedisKey } from '@common/utils/redis.utils';
import { RedisKeyFeature } from '@common/constants/redis-keys.constants';

export interface CacheOptions {
  ttlSeconds?: number;
  keyPrefix?: RedisKeyFeature;
  keySuffix?: string;
}

type DeserializeFn<T> = (raw: string) => T;
type SerializeFn<T> = (value: T) => string;

interface CacheReadOptions<T> {
  deserialize?: DeserializeFn<T>;
}

interface CacheWriteOptions<T> {
  serialize?: SerializeFn<T>;
}

interface GetOrComputeOptions<T>
  extends CacheReadOptions<T>, CacheWriteOptions<T> {
  shouldCache?: (value: T) => boolean;
  validateCached?: (value: T) => boolean;
  onInvalidCached?: () => T | Promise<T>;
  normalizeComputed?: (value: T) => T;
}

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {}

  private tryParseJson<T>(raw: string): { ok: true; value: T } | { ok: false } {
    try {
      return {
        ok: true,
        value: JSON.parse(raw) as T,
      };
    } catch {
      return { ok: false };
    }
  }

  private defaultSerialize<T>(value: T): string {
    return JSON.stringify(value);
  }

  /**
   * Get value from cache
   * @param keyPrefix - Redis key feature
   * @param keySuffix - Additional key suffix (e.g., userId)
   * @returns Cached value or null if not found
   */
  async get<T>(
    keyPrefix: RedisKeyFeature,
    keySuffix: string,
    options?: CacheReadOptions<T>,
  ): Promise<T | null> {
    const cacheKey = buildRedisKey(keyPrefix, keySuffix);
    const deserialize = options?.deserialize;

    try {
      const cached = await this.redisService.get(cacheKey);
      if (cached) {
        this.logger.debug(`Cache hit: ${cacheKey}`);

        if (deserialize) {
          return deserialize(cached);
        }

        const parsed = this.tryParseJson<T>(cached);
        if (!parsed.ok) {
          this.logger.warn(
            `Cache parse failed for ${cacheKey}, treating as cache miss`,
          );
          return null;
        }

        return parsed.value;
      }
      return null;
    } catch (error) {
      this.logger.warn(`Cache get failed for ${cacheKey}: ${error.message}`);
      return null;
    }
  }

  /**
   * Set value in cache with TTL
   * @param keyPrefix - Redis key feature
   * @param keySuffix - Additional key suffix (e.g., userId)
   * @param value - Value to cache
   * @param ttlSeconds - Time to live in seconds
   */
  async set<T>(
    keyPrefix: RedisKeyFeature,
    keySuffix: string,
    value: T,
    ttlSeconds?: number,
    options?: CacheWriteOptions<T>,
  ): Promise<void> {
    const cacheKey = buildRedisKey(keyPrefix, keySuffix);
    const serialize =
      options?.serialize ?? ((input: T) => this.defaultSerialize(input));

    try {
      await this.redisService.set(cacheKey, serialize(value), ttlSeconds);
    } catch (error) {
      this.logger.warn(`Cache set failed for ${cacheKey}: ${error.message}`);
    }
  }

  /**
   * Get or compute value with cache
   * If cache miss, compute value using provided function and cache it
   * @param keyPrefix - Redis key feature
   * @param keySuffix - Additional key suffix (e.g., userId)
   * @param computeFn - Function to compute value if cache miss
   * @param ttlSeconds - Time to live in seconds (required - must be provided by caller)
   * @param options - Optional. shouldCache: only cache when this predicate returns true (default: always cache)
   * @returns Cached or computed value
   */
  async getOrCompute<T>(
    keyPrefix: RedisKeyFeature,
    keySuffix: string,
    computeFn: () => Promise<T>,
    ttlSeconds: number,
    options?: GetOrComputeOptions<T>,
  ): Promise<T> {
    const cached = await this.get<T>(keyPrefix, keySuffix, {
      deserialize: options?.deserialize,
    });
    if (cached !== null) {
      const isValid = options?.validateCached ?? (() => true);
      if (isValid(cached)) {
        return cached;
      }

      if (options?.onInvalidCached) {
        const fallback = await options.onInvalidCached();
        await this.set(keyPrefix, keySuffix, fallback, ttlSeconds, {
          serialize: options.serialize,
        });
        return fallback;
      }

      return cached;
    }

    try {
      const computedValue = await computeFn();
      const normalizeComputed = options?.normalizeComputed ?? ((v: T) => v);
      const value = normalizeComputed(computedValue);
      const shouldCache = options?.shouldCache ?? (() => true);
      if (shouldCache(value)) {
        await this.set(keyPrefix, keySuffix, value, ttlSeconds, {
          serialize: options?.serialize,
        });
      }
      return value;
    } catch (error) {
      this.logger.error(
        `Compute function failed for ${keyPrefix}:${keySuffix}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Invalidate cache by key
   * @param keyPrefix - Redis key feature
   * @param keySuffix - Additional key suffix (e.g., userId)
   */
  async invalidate(
    keyPrefix: RedisKeyFeature,
    keySuffix: string,
  ): Promise<void> {
    const cacheKey = buildRedisKey(keyPrefix, keySuffix);

    try {
      await this.redisService.del(cacheKey);
      this.logger.debug(`Cache invalidated: ${cacheKey}`);
    } catch (error) {
      this.logger.warn(
        `Cache invalidate failed for ${cacheKey}: ${error.message}`,
      );
    }
  }

  /**
   * Invalidate multiple cache keys
   * @param keyPrefix - Redis key feature
   * @param keySuffixes - Array of key suffixes
   */
  async invalidateMany(
    keyPrefix: RedisKeyFeature,
    keySuffixes: string[],
  ): Promise<void> {
    if (keySuffixes.length === 0) return;

    const cacheKeys = keySuffixes.map((suffix) =>
      buildRedisKey(keyPrefix, suffix),
    );

    try {
      await this.redisService.del(cacheKeys);
    } catch (error) {
      this.logger.warn(
        `Cache invalidate many failed for ${keyPrefix}: ${error.message}`,
      );
    }
  }

  /**
   * Invalidate all cache keys for a specific feature (by pattern)
   * Uses SCAN to find all keys matching the feature pattern and deletes them
   * @param keyPrefix - Redis key feature
   */
  async invalidateByFeature(keyPrefix: RedisKeyFeature): Promise<void> {
    const pattern = buildRedisKey(keyPrefix, '*');
    const redis = this.redisService.getClient();
    const keys: string[] = [];
    let cursor = '0';

    try {
      do {
        const [nextCursor, foundKeys] = await redis.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          100,
        );
        cursor = nextCursor;
        keys.push(...foundKeys);
      } while (cursor !== '0');

      if (keys.length > 0) {
        await this.redisService.del(keys);
      }
    } catch (error) {
      this.logger.warn(
        `Cache invalidate by feature failed for ${keyPrefix}: ${error.message}`,
      );
    }
  }
}
