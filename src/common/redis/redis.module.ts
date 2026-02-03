import { Global, Module, Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { RedisService } from './redis.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: 'REDIS_CLIENT',
      useFactory: (configService: ConfigService) => {
        const logger = new Logger('RedisModule');
        const RETRY_DELAY_MS = 5000; // 5 seconds

        const commonOptions = {
          retryStrategy: (times: number) => {
            const delay = Math.min(times * 100, RETRY_DELAY_MS);
            return delay;
          },
          maxRetriesPerRequest: null,
          offlineQueue: false,
          lazyConnect: true,
          enableReadyCheck: false,
        };

        const redisUri = configService.get<string>('redis.uri');
        const redis = redisUri?.trim().length
          ? new Redis(redisUri, commonOptions)
          : new Redis({
              ...commonOptions,
              host: configService.get<string>('redis.host') || 'localhost',
              port: configService.get<number>('redis.port') || 6379,
              password: configService.get<string>('redis.password'),
            });

        redis.connect().catch((error) => {
          logger.warn(
            `Redis initial connection failed (app continues): ${error.message}`,
          );
        });

        return redis;
      },
      inject: [ConfigService],
    },
    RedisService,
  ],
  exports: ['REDIS_CLIENT', RedisService],
})
export class RedisModule {}
