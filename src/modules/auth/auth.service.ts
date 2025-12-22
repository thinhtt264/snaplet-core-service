import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { Types } from 'mongoose';
import { UserService } from '../users/services/user.service';
import { UserValidationService } from '../users/services/user-validation.service';
import { RefreshTokenRepository } from './repositories/refresh-token.repository';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponse } from './interfaces/auth-response.interface';
import { calculateExpirationDate } from '@common/utils';
import { validateRefreshTokenAndDevice } from './validators/auth.validator';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly userService: UserService,
    private readonly userValidationService: UserValidationService,
    private readonly refreshTokenRepository: RefreshTokenRepository,
  ) {}

  /**
   * Đăng ký user mới
   */
  async register(
    registerDto: RegisterDto,
    deviceId: string,
  ): Promise<AuthResponse> {
    // Validate data trước khi tạo user
    await this.userValidationService.validateUserUnique(
      registerDto.email,
      registerDto.username,
    );

    // Tạo user mới
    const user = await this.userService.createUser({
      email: registerDto.email,
      username: registerDto.username,
      firstName: registerDto.firstName,
      lastName: registerDto.lastName,
      password: registerDto.password,
    });

    const accessToken = this.generateAccessToken(user._id.toString());
    const refreshToken = await this.createRefreshToken(
      user._id.toString(),
      deviceId,
    );

    await this.saveRefreshToken(user._id.toString(), deviceId, refreshToken);

    return {
      token: {
        accessToken,
        refreshToken,
      },
      user: {
        id: user._id.toString(),
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarUrl: user.avatarUrl,
      },
    };
  }

  /**
   * Đăng nhập
   */
  async login(loginDto: LoginDto, deviceId: string): Promise<AuthResponse> {
    const user = await this.userService.validateUser(
      loginDto.email,
      loginDto.password,
    );

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const accessToken = this.generateAccessToken(user._id.toString());
    const refreshToken = await this.createRefreshToken(
      user._id.toString(),
      deviceId,
    );

    // Lưu refreshToken vào database (không trả về cho client)
    await this.saveRefreshToken(user._id.toString(), deviceId, refreshToken);

    return {
      token: {
        accessToken,
        refreshToken,
      },
      user: {
        id: user._id.toString(),
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarUrl: user.avatarUrl,
      },
    };
  }

  /**
   * Generate access token (JWT)
   * Expiration được lấy từ file .env
   */
  generateAccessToken(userId: string): string {
    const payload = {
      userId,
      iat: Math.floor(Date.now() / 1000),
    };

    const accessTokenExpiresIn =
      this.configService.get<string>('jwt.expiresIn') || '5m';
    return this.jwtService.sign(payload, {
      expiresIn: accessTokenExpiresIn,
    });
  }

  /**
   * Tạo opaque refresh token (UUID)
   */
  async createRefreshToken(
    _userId: string,
    _deviceId: string,
  ): Promise<string> {
    // Tạo opaque token (UUID)
    return randomUUID();
  }

  /**
   * Generate JWT token với userId (deprecated - dùng generateTokenPair)
   * Expiration được lấy từ file .env
   */
  generateToken(userId: string): string {
    const payload = {
      userId,
      iat: Math.floor(Date.now() / 1000),
    };

    const expiresIn = this.configService.get<string>('jwt.expiresIn') || '5m';
    return this.jwtService.sign(payload, {
      expiresIn,
    });
  }

  /**
   * Lưu refreshToken vào database (hash trước khi lưu)
   * Expiration được lấy từ file .env
   * 1 token per device - xóa token cũ của device trước khi tạo mới
   */
  private async saveRefreshToken(
    userId: string,
    deviceId: string,
    refreshToken: string,
  ): Promise<void> {
    // Hash token trước khi lưu
    const hashedToken =
      await this.refreshTokenRepository.hashToken(refreshToken);

    // Lấy refreshExpiresIn từ config (ví dụ: '30d', '7d', '720h')
    const refreshExpiresIn =
      this.configService.get<string>('jwt.refreshExpiresIn') || '30d';

    // Parse expiration string và tính toán expiresAt
    const expiresAt = calculateExpirationDate(refreshExpiresIn);

    // Lưu vào database (tự động xóa token cũ của device)
    await this.refreshTokenRepository.create(
      userId,
      deviceId,
      hashedToken,
      expiresAt,
    );
  }

  /**
   * Refresh access token với refresh token
   * Rotate refresh token mỗi lần refresh
   */
  async refreshAccessToken(
    refreshToken: string,
    deviceId: string,
  ): Promise<{ accessToken: string }> {
    // Validate refresh token và deviceId
    const validToken = await validateRefreshTokenAndDevice(
      refreshToken,
      deviceId,
      this.refreshTokenRepository,
    );

    // Lấy userId từ token document
    // userId có thể là ObjectId hoặc populated User object
    let userId: string;
    if (validToken.userId instanceof Types.ObjectId) {
      userId = validToken.userId.toString();
    } else if (
      typeof validToken.userId === 'object' &&
      validToken.userId !== null &&
      '_id' in validToken.userId
    ) {
      userId = (validToken.userId as any)._id.toString();
    } else {
      userId = String(validToken.userId);
    }

    // Rotate refresh token - tạo token mới và xóa token cũ
    const newRefreshToken = await this.createRefreshToken(userId, deviceId);
    await this.saveRefreshToken(userId, deviceId, newRefreshToken);

    // Xóa token cũ
    await this.refreshTokenRepository.deleteByHashedToken(
      validToken.hashedToken,
    );

    // Generate access token mới
    const accessToken = this.generateAccessToken(userId);

    return { accessToken };
  }

  /**
   * Logout - Revoke refresh token
   * Xóa refresh token của device hiện tại
   * Khi refresh token bị revoke, access token không thể được refresh nữa
   */
  async logout(userId: string, deviceId: string): Promise<void> {
    // Xóa refresh token của userId và deviceId
    await this.refreshTokenRepository.deleteByUserIdAndDevice(userId, deviceId);
  }

  /**
   * Logout tất cả devices - Revoke tất cả refresh tokens của user
   */
  async logoutAll(userId: string): Promise<void> {
    await this.refreshTokenRepository.deleteByUserId(userId);
  }

  /**
   * Verify và decode JWT token
   */
  verifyToken(token: string): any {
    const secret = this.configService.get<string>('jwt.secret');
    return this.jwtService.verify(token, { secret });
  }

  /**
   * Decode token mà không verify (chỉ để xem payload)
   */
  decodeToken(token: string): any {
    return this.jwtService.decode(token);
  }
}
