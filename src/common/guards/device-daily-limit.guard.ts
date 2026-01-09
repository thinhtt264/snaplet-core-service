import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';
import { REDIS_KEY_FEATURES } from '@common/constants';
import { buildRedisKey } from '@common/utils';

@Injectable()
export class DeviceDailyLimitGuard implements CanActivate {
  private readonly enabled: boolean;
  private readonly ttlSeconds: number;

  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {
    this.enabled =
      this.configService.get<boolean>('auth.deviceRegistrationLimit.enabled') ??
      true;
    const ttlHours =
      this.configService.get<number>('auth.deviceRegistrationLimit.ttlHours') ??
      24;
    this.ttlSeconds = ttlHours * 60 * 60;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Skip validation if disabled
    if (!this.enabled) {
      return true;
    }

    // Skip validation if Redis is not available (soft dependency)
    if (!this.redisService.isRedisAvailable()) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const deviceId = request.headers['x-device-id'];

    if (!deviceId) {
      return true;
    }

    // Generate Redis key: snaplet:{env}:{cacheVersion}:device-registration:{YYYY-MM-DD-HH-MM}
    // Note: Using deviceId as part of the key by appending it
    const redisKey = buildRedisKey(
      REDIS_KEY_FEATURES.DEVICE_REGISTRATION,
      deviceId,
    );

    // Atomic operation: Set key only if it doesn't exist (NX = Not eXists)
    // This prevents race condition between check and set
    const timestamp = Date.now().toString();
    const result = await this.redisService.setIfNotExists(
      redisKey,
      timestamp,
      this.ttlSeconds,
    );

    if (!result) {
      const ttl = await this.redisService.ttl(redisKey);
      // If TTL is -2, Redis might be unavailable, allow request
      if (ttl === -2) {
        return true;
      }
      const hoursRemaining = Math.ceil(ttl / 3600);
      throw new HttpException(
        `Device registration limit reached. You can register again in ${hoursRemaining} hour(s).`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Key was set successfully (atomic operation), allow request to proceed
    // Inject redisKey into request so filter can clear it on error
    request.deviceRegistrationRedisKey = redisKey;

    // Note: If user creation fails, the key should be deleted in auth.service or filter
    return true;
  }
}
