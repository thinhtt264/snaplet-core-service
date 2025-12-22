import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Observable } from 'rxjs';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();

    // Lấy token từ header Authorization: Bearer <token>
    const authHeader = request.headers.authorization;

    // Validate format: Bearer <token>
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Unauthorized token');
    }

    // Extract token
    const token = authHeader.substring(7);

    if (!token || token.trim().length === 0) {
      throw new UnauthorizedException('Unauthorized token');
    }

    try {
      // Verify và decode JWT token
      const secret = this.configService.get<string>('jwt.secret');
      const payload = this.jwtService.verify(token, { secret });

      // Lấy userId từ payload và gắn vào request
      if (!payload.userId) {
        throw new UnauthorizedException('Invalid token payload');
      }

      // Gắn thông tin user vào request để sử dụng trong controller
      request.user = {
        userId: payload.userId,
        ...payload,
      };

      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
