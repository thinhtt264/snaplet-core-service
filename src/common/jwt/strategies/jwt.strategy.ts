import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '@common/redis/redis.service';
import { authActiveSessionKey } from '@common/utils';
import { ActiveAuthSession } from '@modules/auth/interfaces/active-auth-session.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    readonly configService: ConfigService,
    private readonly redis: RedisService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.secret') || '',
    });
  }

  async validate(payload: any) {
    const userId = payload?.userId;
    const authSessionId = payload?.authSessionId;
    const deviceId = payload?.deviceId;

    if (!userId || !authSessionId || !deviceId) {
      throw new UnauthorizedException('Invalid token payload');
    }

    const activeSessionRaw = await this.redis.get(authActiveSessionKey(userId));
    if (!activeSessionRaw) {
      throw new UnauthorizedException('Invalid or expired auth session');
    }

    let activeSession: ActiveAuthSession | null = null;
    try {
      activeSession = JSON.parse(activeSessionRaw);
    } catch {
      activeSession = null;
    }

    if (
      !activeSession ||
      activeSession.authSessionId !== authSessionId ||
      activeSession.deviceId !== deviceId
    ) {
      throw new UnauthorizedException('Invalid or expired auth session');
    }

    return {
      userId,
      authSessionId,
      deviceId,
      ...payload,
    };
  }
}
