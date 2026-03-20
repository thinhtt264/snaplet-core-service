import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';
import { UserService } from '../users/services/user.service';
import { UserValidationService } from '../users/services/user-validation.service';
import {
  StoredRefreshToken,
  AuthRepository,
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
    private readonly authRepository: AuthRepository,
  ) {}

  async register(
    registerDto: RegisterDto,
    deviceId: string,
  ): Promise<AuthResponse> {
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

    const userId = user._id.toString();
    const authSessionId = this.createAuthSessionId();
    await this.authRepository.setActiveAuthSession(
      userId,
      authSessionId,
      deviceId,
    );
    const accessToken = this.generateAccessToken(
      userId,
      authSessionId,
      deviceId,
    );
    const refreshToken = this.createRefreshToken();
    await this.saveRefreshToken(userId, refreshToken);

    return {
      token: {
        accessToken,
        refreshToken,
      },
      user: this.userService.buildUserProfileResponse(user),
    };
  }

  async login(loginDto: LoginDto, deviceId: string): Promise<AuthResponse> {
    const user = await this.userValidationService.validateUser(
      loginDto.email,
      loginDto.password,
    );

    if (!user) {
      throwInvalidCredentials();
    }

    const userId = user._id.toString();
    const authSessionId = this.createAuthSessionId();
    await this.authRepository.setActiveAuthSession(
      userId,
      authSessionId,
      deviceId,
    );
    const accessToken = this.generateAccessToken(
      userId,
      authSessionId,
      deviceId,
    );
    const refreshToken = this.createRefreshToken();

    await this.saveRefreshToken(userId, refreshToken);

    return {
      token: {
        accessToken,
        refreshToken,
      },
      user: this.userService.buildUserProfileResponse(user),
    };
  }

  generateAccessToken(
    userId: string,
    authSessionId: string,
    deviceId: string,
  ): string {
    const payload = {
      userId,
      authSessionId,
      deviceId,
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
    const tokenDoc = await this.authRepository.findByUserId(userId);

    if (!tokenDoc) {
      return null;
    }

    const isValid = await this.verifyToken(token, tokenDoc.hashedToken);
    return isValid ? tokenDoc : null;
  }

  createRefreshToken(): string {
    return randomUUID();
  }

  private createAuthSessionId(): string {
    return randomUUID();
  }

  private async saveRefreshToken(
    userId: string,
    refreshToken: string,
  ): Promise<void> {
    const hashedToken = await this.hashToken(refreshToken);
    await this.authRepository.create(userId, hashedToken);
  }

  async refreshAccessToken(
    refreshToken: string,
    accessToken: string,
    fingerprintDeviceId: string,
  ): Promise<RefreshTokenResponse> {
    let userId: string;
    let accessAuthSessionId: string;
    let accessDeviceId: string;
    try {
      const decoded = this.decodeToken(accessToken);
      userId = decoded?.userId;
      accessAuthSessionId = decoded?.authSessionId;
      accessDeviceId = decoded?.deviceId;
      if (!userId || !accessAuthSessionId || !accessDeviceId) {
        throw new UnauthorizedException('Invalid access token');
      }
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }

    if (accessDeviceId !== fingerprintDeviceId) {
      throw new UnauthorizedException('Invalid or expired access token');
    }

    // Access token must match the currently active auth session
    const activeSession =
      await this.authRepository.getActiveAuthSession(userId);

    if (!activeSession) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (
      activeSession.authSessionId !== accessAuthSessionId ||
      activeSession.deviceId !== accessDeviceId
    ) {
      // Old device refresh must fail to support:
      // API 401 -> refresh -> 401 -> force logout
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const validToken = await this.findAndVerifyTokenByUserId(
      refreshToken,
      userId,
    );

    if (!validToken) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Rotate auth session on refresh (Option B)
    const newAuthSessionId = this.createAuthSessionId();
    await this.authRepository.setActiveAuthSession(
      userId,
      newAuthSessionId,
      accessDeviceId,
    );

    const newRefreshToken = this.createRefreshToken();
    await this.saveRefreshToken(userId, newRefreshToken);

    return {
      accessToken: this.generateAccessToken(
        userId,
        newAuthSessionId,
        accessDeviceId,
      ),
      refreshToken: newRefreshToken,
    };
  }

  async logout(userId: string): Promise<void> {
    await this.authRepository.deleteActiveAuthSession(userId);
    await this.authRepository.deleteByUserId(userId);
  }

  verifyJwtToken(token: string): any {
    const secret = this.configService.get<string>('jwt.secret');
    return this.jwtService.verify(token, { secret });
  }

  decodeToken(token: string): any {
    return this.jwtService.decode(token);
  }
}
