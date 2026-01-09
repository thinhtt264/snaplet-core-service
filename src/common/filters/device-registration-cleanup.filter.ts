import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { RedisService } from '@common/redis/redis.service';

/**
 * Filter to clear device registration Redis key when register endpoint fails
 * This ensures the key created by DeviceDailyLimitGuard is cleared on error
 */
@Injectable()
@Catch()
export class DeviceRegistrationCleanupFilter implements ExceptionFilter {
  constructor(private readonly redisService: RedisService) {}

  async catch(exception: unknown, host: ArgumentsHost): Promise<void> {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest();

    await this.clearDeviceRegistrationKeyOnError(request, exception);
  }

  /**
   * Clear device registration Redis key if register endpoint fails
   * This ensures the key is cleared even if auth.service doesn't catch the error
   */
  private async clearDeviceRegistrationKeyOnError(
    request: any,
    exception: unknown,
  ): Promise<void> {
    try {
      // Check if guard has set the redisKey in request
      // If not set, it means either:
      // 1. Guard didn't run (disabled or no deviceId)
      // 2. Guard threw exception before setting key (limit reached)
      const redisKey = request?.deviceRegistrationRedisKey;

      if (!redisKey) {
        return;
      }

      // Skip if the exception is from DeviceDailyLimitGuard itself
      // (it means the limit was already reached, no key was created)
      if (
        exception instanceof HttpException &&
        exception.getStatus() === HttpStatus.TOO_MANY_REQUESTS
      ) {
        return;
      }

      // Clear the Redis key if Redis is available
      if (!this.redisService.isRedisAvailable()) {
        return;
      }

      await this.redisService.del(redisKey);
    } catch {
      // Silently fail - don't let Redis errors affect error response
    }
  }
}
