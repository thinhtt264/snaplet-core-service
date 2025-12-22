import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from './schemas/user.schema';
import { UserService } from './services/user.service';
import { UserValidationService } from './services/user-validation.service';
import { UserRepository } from './repositories/user.repository';
import { UsersController } from './controllers/users.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
  ],
  controllers: [UsersController],
  providers: [UserService, UserValidationService, UserRepository],
  exports: [UserService, UserValidationService],
})
export class UsersModule {}
