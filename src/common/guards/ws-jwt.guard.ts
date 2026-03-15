import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';

@Injectable()
export class WsJwtGuard implements CanActivate {
  private readonly logger = new Logger(WsJwtGuard.name);

  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client = context.switchToWs().getClient();
    const token = client.handshake?.auth?.token;

    if (!token) {
      this.logger.warn('WS connection rejected: no token');
      throw new WsException('Unauthorized');
    }

    try {
      const payload = await this.jwtService.verifyAsync(token);
      const userId = payload?.userId;
      if (!userId) {
        throw new WsException('Unauthorized');
      }
      (client as any).userId = userId;
      return true;
    } catch {
      this.logger.warn('WS connection rejected: invalid token');
      throw new WsException('Unauthorized');
    }
  }
}
