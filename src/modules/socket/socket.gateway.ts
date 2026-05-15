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
import { RootSocketData, SocketService } from './socket.service';
import { PresenceService } from './presence.service';
import {
  SOCKET_USER_CONNECTED,
  PARTNER_ONLINE,
  PARTNER_OFFLINE,
} from './events/socket-events';
import type {
  UserConnectedEvent,
  PartnerPresencePayload,
} from './events/socket-events';
import { RedisService } from '@common/redis/redis.service';
import { authActiveSessionKey } from '@common/utils';
import { ActiveAuthSession } from '@modules/auth/interfaces/active-auth-session.interface';
import { RelationshipService } from '@modules/relationships/services/relationship.service';

type AuthenticatedSocket = Socket & { userId?: string };

/** Engine.IO transport socket (`socket.conn`) — heartbeat hook target. */
interface EngineSocketWithUser {
  userId?: string;
  on(event: 'heartbeat', listener: () => void): void;
}

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
    private readonly redis: RedisService,
    private readonly presenceService: PresenceService,
    private readonly relationshipService: RelationshipService,
  ) {}

  afterInit(): void {
    this.socketService.setServer(this.server);
    this.server.use(this.createAuthMiddleware());
  }

  async handleConnection(client: AuthenticatedSocket): Promise<void> {
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

    await this.presenceService.setOnline(userId);
    void this.broadcastPresence(userId, true);
    this.attachHeartbeatPresenceRefresh(client);

    setImmediate(() => {
      this.eventEmitter.emit(SOCKET_USER_CONNECTED, {
        userId,
        sessionId,
      } satisfies UserConnectedEvent);
    });

    this.logger.debug(`WS client connected, userId=${userId}`);
  }

  handleDisconnect(client: AuthenticatedSocket): void {
    const userId = client.userId;
    this.logger.debug(`WS client disconnected, userId=${userId}`);

    if (!userId) return;

    setImmediate(() => {
      void (async () => {
        await this.presenceService.setOffline(userId);
        await this.broadcastPresence(userId, false);
      })();
    });
  }

  /** Refresh presence TTL on engine heartbeat (Nest `@WebSocketServer()` is a Namespace, not root Server). */
  private attachHeartbeatPresenceRefresh(client: AuthenticatedSocket): void {
    const engineSocket = client.conn as EngineSocketWithUser | undefined;
    if (!engineSocket?.on) return;

    engineSocket.on('heartbeat', () => {
      const userId = client.userId ?? engineSocket.userId;
      if (!userId) return;

      void this.presenceService.setOnline(userId);
    });
  }

  private async broadcastPresence(
    userId: string,
    isOnline: boolean,
  ): Promise<void> {
    const friendIds = await this.relationshipService.getMyFriendIds(userId);
    if (friendIds.length === 0) return;

    const event = isOnline ? PARTNER_ONLINE : PARTNER_OFFLINE;
    const payload = { userId } satisfies PartnerPresencePayload;

    const presenceChecks = await Promise.all(
      friendIds.map(async (friendId) => ({
        friendId,
        present: await this.socketService.isUserPresentInUserRoom(friendId),
      })),
    );

    const targets = presenceChecks.filter((entry) => entry.present);

    await Promise.all(
      targets.map(({ friendId }) =>
        Promise.resolve(
          this.server
            .to(this.socketService.getUserRoom(friendId))
            .emit(event, payload),
        ),
      ),
    );
  }

  private createAuthMiddleware() {
    return async (
      socket: AuthenticatedSocket,
      next: (err?: Error) => void,
    ): Promise<void> => {
      const token = socket.handshake?.auth?.token;

      if (!token) {
        return next(new Error('Unauthorized'));
      }

      try {
        const payload = await this.jwtService.verifyAsync(token);
        const userId = payload?.userId;
        const authSessionId = payload?.authSessionId;
        const deviceId = payload?.deviceId;

        if (!userId || !authSessionId || !deviceId) {
          return next(new Error('Invalid token payload'));
        }

        const activeSessionRaw = await this.redis.get(
          authActiveSessionKey(userId),
        );
        if (!activeSessionRaw) {
          return next(new Error('Unauthorized'));
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
          return next(new Error('Unauthorized'));
        }

        socket.userId = userId;
        (socket.data as RootSocketData).userId = userId;

        (socket.conn as EngineSocketWithUser).userId = userId;

        next();
      } catch {
        this.logger.warn('WS connection rejected: invalid token');
        next(new Error('Unauthorized'));
      }
    };
  }
}
