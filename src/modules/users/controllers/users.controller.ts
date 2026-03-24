import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserValidationService } from '../services/user-validation.service';
import { UserService } from '../services/user.service';
import { CheckEmailDto } from '../dto/check-email.dto';
import { CheckUsernameDto } from '../dto/check-username.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { CurrentUserId } from 'src/common/decorators/current-user.decorator';
import { RequestAvatarUploadDto } from '../dto/request-avatar-upload.dto';
import { ConfirmAvatarUploadDto } from '../dto/confirm-avatar-upload.dto';
import { UpdateDisplayNameDto } from '../dto/update-display-name.dto';
import {
  AvatarUploadRequestResponse,
  IUserProfileResponse,
} from '../interfaces/user-response.interface';
import { Throttle } from '@nestjs/throttler';
import { SearchUsersQueryDto } from '../dto/search-users.dto';
import type { SearchUserItemResponse } from '../interfaces/user-search-response.interface';

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

  @Get('search')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 40, ttl: 10000 } })
  async searchUsers(
    @Query() dto: SearchUsersQueryDto,
    @CurrentUserId() userId: string,
  ): Promise<SearchUserItemResponse[]> {
    return this.userService.searchUsers(dto.q, dto.limit, userId);
  }

  @Post('avatar/upload/request')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async requestAvatarUpload(
    @CurrentUserId() userId: string,
    @Body() dto: RequestAvatarUploadDto,
  ): Promise<AvatarUploadRequestResponse> {
    return this.userService.requestAvatarUpload(userId, dto.mimeType, dto.size);
  }

  @Post('avatar/upload/confirm')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async changeAvatar(
    @CurrentUserId() userId: string,
    @Body() dto: ConfirmAvatarUploadDto,
  ): Promise<IUserProfileResponse> {
    return this.userService.confirmAvatarUpload(userId, dto.key);
  }

  @Delete('avatar')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async deleteAvatar(
    @CurrentUserId() userId: string,
  ): Promise<IUserProfileResponse> {
    return this.userService.deleteAvatar(userId);
  }

  @Patch('display-name')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async updateDisplayName(
    @CurrentUserId() userId: string,
    @Body() dto: UpdateDisplayNameDto,
  ): Promise<IUserProfileResponse> {
    return this.userService.updateDisplayName(
      userId,
      dto.firstName,
      dto.lastName,
    );
  }
}
