import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import {
  RefreshToken,
  RefreshTokenSchema,
} from './schemas/refresh-token.schema';
import { RefreshTokenRepository } from './repositories/refresh-token.repository';
import { UsersModule } from '@modules/users/users.module';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('jwt.secret') || 'your-secret-key',
        signOptions: {
          expiresIn: (configService.get<string>('jwt.expiresIn') ||
            '7d') as any,
        },
      }),
      inject: [ConfigService],
    }),
    MongooseModule.forFeature([
      { name: RefreshToken.name, schema: RefreshTokenSchema },
    ]),
    UsersModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, RefreshTokenRepository],
  exports: [JwtModule, AuthService, RefreshTokenRepository],
})
export class AuthModule {}
