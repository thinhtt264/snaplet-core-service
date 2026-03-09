import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';
import { UserService } from '../users/services/user.service';
import { UserValidationService } from '../users/services/user-validation.service';
import {
  RefreshTokenRepository,
  StoredRefreshToken,
} from './repositories/refresh-token.repository';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import {
  AuthResponse,
  RefreshTokenResponse,
} from './interfaces/auth-response.interface';
import { throwInvalidCredentials } from '@common/utils';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly userService: UserService,
    private readonly userValidationService: UserValidationService,
    private readonly refreshTokenRepository: RefreshTokenRepository,
  ) {}

  async register(registerDto: RegisterDto): Promise<any> {
    // Note: DeviceDailyLimitGuard already set the Redis key atomically
    // If user creation fails, DeviceRegistrationCleanupFilter will clear the key
    await this.userValidationService.validateUserUnique(
      registerDto.email,
      registerDto.username,
    );
    const user = await this.userService.createUser({
      email: registerDto.email,
      username: registerDto.username,
      firstName: registerDto.firstName,
      lastName: registerDto.lastName,
      password: registerDto.password,
    });

    const accessToken = this.generateAccessToken(user._id.toString());
    const refreshToken = this.createRefreshToken();
    await this.saveRefreshToken(user._id.toString(), refreshToken);

    return {
      token: {
        accessToken,
        refreshToken,
      },
      user: this.userService.buildUserProfileResponse(user),
    };
  }

  async login(loginDto: LoginDto): Promise<AuthResponse> {
    const user = await this.userValidationService.validateUser(
      loginDto.email,
      loginDto.password,
    );

    if (!user) {
      throwInvalidCredentials();
    }

    const accessToken = this.generateAccessToken(user._id.toString());
    const refreshToken = this.createRefreshToken();

    await this.saveRefreshToken(user._id.toString(), refreshToken);

    return {
      token: {
        accessToken,
        refreshToken,
      },
      user: this.userService.buildUserProfileResponse(user),
    };
  }

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

  private async hashToken(token: string): Promise<string> {
    const saltRounds = 10;
    return bcrypt.hash(token, saltRounds);
  }

  private async verifyToken(
    token: string,
    hashedToken: string,
  ): Promise<boolean> {
    return bcrypt.compare(token, hashedToken);
  }

  async findAndVerifyTokenByUserId(
    token: string,
    userId: string,
  ): Promise<StoredRefreshToken | null> {
    const tokenDoc = await this.refreshTokenRepository.findByUserId(userId);

    if (!tokenDoc) {
      return null;
    }

    const isValid = await this.verifyToken(token, tokenDoc.hashedToken);
    return isValid ? tokenDoc : null;
  }

  createRefreshToken(): string {
    return randomUUID();
  }

  private async saveRefreshToken(
    userId: string,
    refreshToken: string,
  ): Promise<void> {
    const hashedToken = await this.hashToken(refreshToken);
    await this.refreshTokenRepository.create(userId, hashedToken);
  }

  async refreshAccessToken(
    refreshToken: string,
    accessToken: string,
  ): Promise<RefreshTokenResponse> {
    let userId: string;
    try {
      const decoded = this.decodeToken(accessToken);
      userId = decoded?.userId;
      if (!userId) {
        throw new UnauthorizedException('Invalid access token');
      }
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }

    const validToken = await this.findAndVerifyTokenByUserId(
      refreshToken,
      userId,
    );

    if (!validToken) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const newRefreshToken = this.createRefreshToken();
    await this.saveRefreshToken(userId, newRefreshToken);

    return {
      accessToken: this.generateAccessToken(userId),
      refreshToken: newRefreshToken,
    };
  }

  async logout(userId: string): Promise<void> {
    await this.refreshTokenRepository.deleteByUserId(userId);
  }

  verifyJwtToken(token: string): any {
    const secret = this.configService.get<string>('jwt.secret');
    return this.jwtService.verify(token, { secret });
  }

  decodeToken(token: string): any {
    return this.jwtService.decode(token);
  }
}
