import { Controller, Get, Query } from '@nestjs/common';
import { UserValidationService } from '../services/user-validation.service';
import { CheckEmailDto } from '../dto/check-email.dto';
import { CheckUsernameDto } from '../dto/check-username.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly userValidationService: UserValidationService) {}

  /**
   * Check email availability
   * GET /api/v1/users/email-availability?email=test@mail.com
   */
  @Get('email-availability')
  checkEmail(@Query() checkEmailDto: CheckEmailDto) {
    return this.userValidationService.checkEmailAvailable(checkEmailDto.email);
  }

  /**
   * Check username availability
   * GET /api/v1/users/username-availability?username=johndoe
   */
  @Get('username-availability')
  checkUsername(@Query() checkUsernameDto: CheckUsernameDto) {
    return this.userValidationService.checkUsernameAvailable(
      checkUsernameDto.username,
    );
  }
}
