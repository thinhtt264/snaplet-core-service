import {
  Controller,
  Post,
  Body,
  Get,
  Query,
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
import { DeviceId } from '../../common/decorators/header.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Đăng ký user mới
   * POST /api/v1/auth/register
   * Header: X-Device-Id (required)
   */
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() registerDto: RegisterDto,
    @DeviceId() deviceId: string,
  ) {
    return this.authService.register(registerDto, deviceId);
  }

  /**
   * Đăng nhập
   * POST /api/v1/auth/login
   * Header: X-Device-Id (required)
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto, @DeviceId() deviceId: string) {
    return this.authService.login(loginDto, deviceId);
  }

  /**
   * Refresh access token
   * POST /api/v1/auth/refresh
   * Header: X-Device-Id (required)
   */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body() refreshTokenDto: RefreshTokenDto,
    @DeviceId() deviceId: string,
  ) {
    return this.authService.refreshAccessToken(
      refreshTokenDto.refreshToken,
      deviceId,
    );
  }

  /**
   * Logout - Revoke refresh token của device hiện tại
   * Khi refresh token bị revoke, access token không thể được refresh nữa
   * POST /api/v1/auth/logout
   * Headers:
   *   - Authorization: Bearer <accessToken> (required)
   *   - X-Device-Id: <deviceId> (required)
   */
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

  /**
   * Verify JWT token
   * GET /api/v1/auth/verify-token?token=xxx
   */
  @Get('verify-token')
  verifyToken(@Query('token') token: string) {
    if (!token) {
      return {
        success: false,
        message: 'token is required',
      };
    }

    try {
      const payload = this.authService.verifyToken(token);
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
