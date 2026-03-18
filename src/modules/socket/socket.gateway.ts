import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SocketService } from './socket.service';
import { SOCKET_USER_CONNECTED } from './events/socket-events';
import type { UserConnectedEvent } from './events/socket-events';

@WebSocketGateway({
  cors: {
    origin: true,
    credentials: true,
  },
  namespace: '/',
})
export class SocketGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(SocketGateway.name);

  constructor(
    private readonly socketService: SocketService,
    private readonly jwtService: JwtService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  afterInit(): void {
    this.socketService.setServer(this.server);
    this.server.use(this.createAuthMiddleware());
  }

  handleConnection(client: Socket & { userId?: string }): void {
    const userId = client.userId;
    const sessionId = client.handshake?.auth?.sessionId;

    if (!userId || !sessionId) {
      this.logger.warn(
        `WS connection missing auth info, disconnecting (userId=${userId}, sessionId=${sessionId})`,
      );
      client.disconnect();
      return;
    }

    const room = this.socketService.getUserRoom(userId);
    client.join(room);

    setImmediate(() => {
      this.eventEmitter.emit(SOCKET_USER_CONNECTED, {
        userId,
        sessionId,
      } satisfies UserConnectedEvent);
    });

    this.logger.debug(`WS client connected, userId=${userId}`);
  }

  handleDisconnect(client: any): void {
    const userId = client?.userId as string | undefined;
    this.logger.debug(`WS client disconnected, userId=${userId}`);
    // Nothing to do on disconnect; TTL handles session keys
  }

  private createAuthMiddleware() {
    return async (socket: any, next: (err?: Error) => void): Promise<void> => {
      const token = socket.handshake?.auth?.token;

      if (!token) {
        this.logger.warn('WS connection rejected: no token');
        return next(new Error('Unauthorized'));
      }

      try {
        const payload = await this.jwtService.verifyAsync(token);
        if (!payload?.userId) {
          return next(new Error('Invalid token payload'));
        }
        socket.userId = payload.userId;
        next();
      } catch {
        this.logger.warn('WS connection rejected: invalid token');
        next(new Error('Unauthorized'));
      }
    };
  }
}
