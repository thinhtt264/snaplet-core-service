import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import configuration from '@config/configuration';
import { DatabaseModule } from '@database/database.module';
import { CommonJwtModule } from '@common/jwt/jwt.module';
import { RedisModule } from '@common/redis/redis.module';
import { HealthModule } from '@modules/health/health.module';
import { PostsModule } from '@modules/posts/posts.module';
import { RelationshipsModule } from '@modules/relationships/relationships.module';
import { AuthModule } from '@modules/auth/auth.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TransformInterceptor } from '@common/interceptors/transform.interceptor';
import { LoggingInterceptor } from '@common/interceptors/logging.interceptor';
import { HttpExceptionFilter } from '@common/filters/http-exception.filter';
import { DeviceRegistrationCleanupFilter } from '@common/filters/device-registration-cleanup.filter';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: '.env',
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        throttlers: [
          {
            ttl: (configService.get<number>('throttle.ttl') || 90) * 1000, // Convert to milliseconds
            limit: configService.get<number>('throttle.limit') || 5,
          },
        ],
        errorMessage: 'Too Many Requests',
      }),
    }),
    DatabaseModule,
    RedisModule,
    CommonJwtModule,
    AuthModule,
    HealthModule,
    PostsModule,
    RelationshipsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    DeviceRegistrationCleanupFilter,
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
  ],
})
export class AppModule {}
