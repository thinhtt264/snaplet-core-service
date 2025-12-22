import {
  Controller,
  Post,
  Body,
  Get,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUserId } from '../../common/decorators/current-user.decorator';
import {
  DeviceId,
  AccessToken,
} from '../../common/decorators/header.decorator';
import { RefreshTokenResponse } from './interfaces/auth-response.interface';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() registerDto: RegisterDto,
    @DeviceId() deviceId: string,
  ) {
    return this.authService.register(registerDto, deviceId);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto, @DeviceId() deviceId: string) {
    return this.authService.login(loginDto, deviceId);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body() refreshTokenDto: RefreshTokenDto,
    @DeviceId() deviceId: string,
  ): Promise<RefreshTokenResponse> {
    return this.authService.refreshAccessToken(
      refreshTokenDto.refreshToken,
      refreshTokenDto.accessToken,
      deviceId,
    );
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(
    @CurrentUserId() userId: string,
    @DeviceId() deviceId: string,
  ): Promise<{ message: string }> {
    await this.authService.logout(userId, deviceId);
    return { message: 'Logged out successfully' };
  }

  @Get('verify-token')
  verifyToken(@AccessToken() token: string) {
    try {
      const payload = this.authService.verifyJwtToken(token);
      return {
        success: true,
        data: payload,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Invalid or expired token',
        error: error.message,
      };
    }
  }
}
