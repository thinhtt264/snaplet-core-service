import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AuthRepository } from './repositories/refresh-token.repository';
import { UsersModule } from '@modules/users/users.module';
import { RelationshipsModule } from '@modules/relationships/relationships.module';

@Module({
  imports: [UsersModule, RelationshipsModule],
  controllers: [AuthController],
  providers: [AuthService, AuthRepository],
})
export class AuthModule {}
