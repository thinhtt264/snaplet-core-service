import {
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { randomInt } from 'crypto';
import * as bcrypt from 'bcrypt';
import { UserService } from '../users/services/user.service';
import { UserValidationService } from '../users/services/user-validation.service';
import { UserRepository } from '@modules/users/repositories/user.repository';
import {
  StoredRefreshToken,
  AuthRepository,
} from './repositories/refresh-token.repository';
import { RelationshipService } from '@modules/relationships/services/relationship.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { GoogleSignInDto } from './dto/google-signin.dto';
import {
  AuthResponse,
  RefreshTokenResponse,
} from './interfaces/auth-response.interface';
import { throwInvalidCredentials } from '@common/utils';
import type {
  GooglePayload,
  GoogleSignInResponse,
} from './interfaces/google-signin-result.interface';
import type { User } from '@modules/users/schemas/user.schema';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly userService: UserService,
    private readonly userValidationService: UserValidationService,
    private readonly userRepository: UserRepository,
    private readonly authRepository: AuthRepository,
    private readonly relationshipService: RelationshipService,
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

  private async verifyGoogleToken(idToken: string): Promise<GooglePayload> {
    const clientId = this.configService.get<string>('google.clientId');
    if (!clientId) {
      throw new InternalServerErrorException('Missing GOOGLE_CLIENT_ID');
    }

    try {
      const { OAuth2Client } = await import('google-auth-library');
      const client = new OAuth2Client(clientId);

      const ticket = await client.verifyIdToken({
        idToken,
        audience: clientId,
      });

      const payload = ticket.getPayload();
      if (!payload?.sub || !payload?.email) {
        throw new UnauthorizedException('INVALID_GOOGLE_TOKEN');
      }

      return {
        email: payload.email,
        googleId: payload.sub,
        firstName: payload.given_name ?? payload.name ?? '',
        lastName: payload.family_name ?? '',
      };
    } catch {
      throw new UnauthorizedException('INVALID_GOOGLE_TOKEN');
    }
  }

  private async generateDefaultUsername(): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt++) {
      const suffix = randomInt(0, 1_000_000).toString().padStart(6, '0');
      const username = `snaplet_user_${suffix}`;
      const taken = await this.userValidationService.isUsernameTaken(username);
      if (!taken) return username;
    }

    throw new InternalServerErrorException('Unable to generate username');
  }

  private async issueTokensForUser(
    user: User,
    deviceId: string,
  ): Promise<AuthResponse> {
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
      token: { accessToken, refreshToken },
      user: this.userService.buildUserProfileResponse(user),
    };
  }

  async loginWithGoogle(
    dto: GoogleSignInDto,
    deviceId: string,
  ): Promise<GoogleSignInResponse> {
    const googlePayload = await this.verifyGoogleToken(dto.idToken);
    const { email, googleId, firstName, lastName } = googlePayload;

    // CASE A: already has Google account linked
    let user = await this.userRepository.findByGoogleId(googleId);
    if (user) {
      const tokens = await this.issueTokensForUser(user, deviceId);
      return {
        ...tokens,
        requiresOnboarding: user.isOnboardingComplete === false,
      };
    }

    // CASE B: local account exists with same email -> link & login
    const existingLocal = await this.userRepository.findActiveByEmail(email);
    if (existingLocal) {
      user = await this.userRepository.linkGoogleId(
        existingLocal._id.toString(),
        googleId,
      );
      const tokens = await this.issueTokensForUser(user, deviceId);
      return { ...tokens, requiresOnboarding: false };
    }

    // CASE C: brand new user -> create partial account with defaults, require onboarding
    const username = await this.generateDefaultUsername();
    user = await this.userRepository.create({
      email,
      googleId,
      authProvider: 'google',
      password: null,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      username,
      isOnboardingComplete: false,
    });

    const tokens = await this.issueTokensForUser(user, deviceId);
    return { ...tokens, requiresOnboarding: true };
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
    try {
      await Promise.all([
        this.userService.clearSessionResourcesForLogout(userId),
        this.relationshipService.invalidateCachesForUser(userId),
        this.authRepository.deleteActiveAuthSession(userId),
        this.authRepository.deleteByUserId(userId),
      ]);
    } catch {
      throw new InternalServerErrorException('Failed to logout');
    }
  }

  verifyJwtToken(token: string): any {
    try {
      const secret = this.configService.get<string>('jwt.secret');
      return this.jwtService.verify(token, { secret });
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }

  decodeToken(token: string): any {
    return this.jwtService.decode(token);
  }
}
