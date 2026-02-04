import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '@common/redis/redis.service';
import { refreshTokenKey } from '@common/utils/redis.utils';
import { expiresInToSeconds } from '@common/utils';

/** Stored refresh token (Redis value). One per user, keyed by userId. */
export interface StoredRefreshToken {
  hashedToken: string;
}

@Injectable()
export class RefreshTokenRepository {
  constructor(
    private readonly redis: RedisService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Store one refresh token per user. Overwrites any existing token for this user.
   */
  async create(
    userId: string,
    hashedToken: string,
  ): Promise<StoredRefreshToken> {
    const key = refreshTokenKey(userId);
    const refreshExpiresIn =
      this.configService.get<string>('jwt.refreshExpiresIn') || '30d';
    const ttlSeconds = expiresInToSeconds(refreshExpiresIn);
    await this.redis.set(key, hashedToken, ttlSeconds);
    return { hashedToken };
  }

  /**
   * Get the stored refresh token for the user.
   * Returns null if key is missing or expired (Redis TTL).
   */
  async findByUserId(userId: string): Promise<StoredRefreshToken | null> {
    const key = refreshTokenKey(userId);
    const hashedToken = await this.redis.get(key);
    if (!hashedToken) {
      return null;
    }
    return { hashedToken };
  }

  async deleteByUserId(userId: string): Promise<void> {
    const key = refreshTokenKey(userId);
    await this.redis.del(key);
  }
}
