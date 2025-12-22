import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const uri = configService.get<string>('database.uri');
        const user = configService.get<string>('database.user');
        const pass = configService.get<string>('database.password');

        return {
          uri,
          user,
          pass,
          retryAttempts: 3,
          retryDelay: 1000,
        };
      },
      inject: [ConfigService],
    }),
  ],
})
export class DatabaseModule {}
