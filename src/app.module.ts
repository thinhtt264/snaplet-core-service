import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import configuration from '@config/configuration';
import { DatabaseModule } from '@database/database.module';
import { HealthModule } from '@modules/health/health.module';
import { PostsModule } from '@modules/posts/posts.module';
import { RelationshipsModule } from '@modules/relationships/relationships.module';
import { AuthModule } from '@modules/auth/auth.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TransformInterceptor } from '@common/interceptors/transform.interceptor';
import { LoggingInterceptor } from '@common/interceptors/logging.interceptor';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: '.env',
    }),
    // Database
    DatabaseModule,
    // Modules
    AuthModule,
    HealthModule,
    PostsModule,
    RelationshipsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
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
