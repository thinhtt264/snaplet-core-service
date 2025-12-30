import { Controller, Get, Query, Param } from '@nestjs/common';
import { UserValidationService } from '../services/user-validation.service';
import { UserService } from '../services/user.service';
import { CheckEmailDto } from '../dto/check-email.dto';
import { CheckUsernameDto } from '../dto/check-username.dto';

@Controller('users')
export class UsersController {
  constructor(
    private readonly userValidationService: UserValidationService,
    private readonly userService: UserService,
  ) {}

  @Get('email-availability')
  checkEmail(@Query() checkEmailDto: CheckEmailDto) {
    return this.userValidationService.checkEmailAvailable(checkEmailDto.email);
  }

  @Get('username-availability')
  checkUsername(@Query() checkUsernameDto: CheckUsernameDto) {
    return this.userValidationService.checkUsernameAvailable(
      checkUsernameDto.username,
    );
  }

  @Get('profile/:username')
  async getUserProfile(@Param('username') username: string) {
    const userInfo = await this.userService.getUserProfileByUsername(username);

    return userInfo;
  }
}
