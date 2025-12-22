import { Module } from '@nestjs/common';
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
    MongooseModule.forFeature([
      { name: RefreshToken.name, schema: RefreshTokenSchema },
    ]),
    UsersModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, RefreshTokenRepository],
})
export class AuthModule {}
