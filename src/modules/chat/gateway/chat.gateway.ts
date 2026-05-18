import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { RedisService } from '@common/redis/redis.service';
import { authActiveSessionKey } from '@common/utils';
import type { ActiveAuthSession } from '@modules/auth/interfaces/active-auth-session.interface';
import {
  CHAT_JOIN_CONVERSATION,
  CHAT_LEAVE_CONVERSATION,
  CHAT_TYPING_START,
  CHAT_TYPING_STOP,
  type ChatServerEvent,
} from '../events/chat-socket-events';
import { TypingService } from '../services/typing.service';
import { ReadReceiptService } from '../services/read-receipt.service';
import { ConversationService } from '../services/conversation.service';
import { SocketService } from '@modules/socket/socket.service';

/** Persisted on `socket.data` so `fetchSockets()` (incl. Redis adapter) can read userId. */
export interface ChatSocketData {
  userId?: string;
}

@Injectable()
@WebSocketGateway({
  namespace: '/chat',
  cors: {
    origin: true,
    credentials: true,
  },
})
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly redis: RedisService,
    private readonly conversationService: ConversationService,
    private readonly socketService: SocketService,
    @Inject(forwardRef(() => TypingService))
    private readonly typingService: TypingService,
    @Inject(forwardRef(() => ReadReceiptService))
    private readonly readReceiptService: ReadReceiptService,
  ) {}

  afterInit(): void {
    this.server.use(this.createAuthMiddleware());
  }

  async handleConnection(client: Socket & { userId?: string }): Promise<void> {
    if (!client.userId) {
      client.disconnect();
      return;
    }

    void client.join(this.socketService.getUserRoom(client.userId));

    const conversationId = client.handshake?.auth?.conversationId as
      | string
      | undefined;
    if (conversationId) {
      // isMember dùng Redis cache nên reconnect liên tục không tốn DB query
      const isMember = await this.conversationService.isMember(
        conversationId,
        client.userId,
      );
      if (!isMember) {
        client.emit('error', {
          message: 'Forbidden: not a member of this conversation',
        });
        client.disconnect();
        return;
      }
      void client.join(this.getConversationSocketRoom(conversationId));
    }

    this.logger.debug(
      `Chat WS connected, userId=${client.userId}, convId=${conversationId}`,
    );
  }

  handleDisconnect(client: Socket & { userId?: string }): void {
    this.logger.debug(`Chat WS disconnected, userId=${client.userId}`);
  }

  @SubscribeMessage(CHAT_JOIN_CONVERSATION)
  async handleJoin(
    @ConnectedSocket() client: Socket & { userId: string },
    @MessageBody() payload: { conversationId: string },
  ): Promise<void> {
    const isMember = await this.conversationService.isMember(
      payload.conversationId,
      client.userId,
    );
    if (!isMember) {
      client.emit('error', { message: 'Not a member of this conversation' });
      return;
    }
    client.join(this.getConversationSocketRoom(payload.conversationId));
  }

  @SubscribeMessage(CHAT_LEAVE_CONVERSATION)
  handleLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId: string },
  ): void {
    client.leave(this.getConversationSocketRoom(payload.conversationId));
  }

  @SubscribeMessage(CHAT_TYPING_START)
  async handleTypingStart(
    @ConnectedSocket() client: Socket & { userId: string },
    @MessageBody() payload: { conversationId: string },
  ): Promise<void> {
    const isMember = await this.conversationService.isMember(
      payload.conversationId,
      client.userId,
    );
    if (!isMember) return;
    await this.typingService.start(payload.conversationId, client.userId);
  }

  @SubscribeMessage(CHAT_TYPING_STOP)
  async handleTypingStop(
    @ConnectedSocket() client: Socket & { userId: string },
    @MessageBody() payload: { conversationId: string },
  ): Promise<void> {
    await this.typingService.stop(payload.conversationId, client.userId);
  }

  broadcastToRoom(
    convId: string,
    event: ChatServerEvent,
    payload: unknown,
    excludeSocketId?: string,
  ): void {
    const room = this.server.to(this.getConversationSocketRoom(convId));
    const target = excludeSocketId ? room.except(excludeSocketId) : room;
    target.emit(event, payload);
  }

  /**
   * True if this user has at least one `/chat` socket joined to `conv:{conversationId}`
   * (same room as `CHAT_JOIN_CONVERSATION` / handshake `conversationId`).
   */
  async isUserPresentInConversationRoom(
    userId: string,
    conversationId: string,
  ): Promise<boolean> {
    const room = this.getConversationSocketRoom(conversationId);
    try {
      const sockets = await this.server.in(room).fetchSockets();
      return sockets.some(
        (remote) => (remote.data as ChatSocketData).userId === userId,
      );
    } catch (err) {
      this.logger.warn(
        `Conversation presence check failed room=${room}: ${(err as Error).message}`,
      );
      return false;
    }
  }

  private getConversationSocketRoom(conversationId: string): string {
    return `conv:${conversationId}`;
  }

  private createAuthMiddleware() {
    return async (socket: any, next: (err?: Error) => void): Promise<void> => {
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
        (socket.data as ChatSocketData).userId = userId;
        next();
      } catch {
        this.logger.warn('Chat WS connection rejected: invalid token');
        next(new Error('Unauthorized'));
      }
    };
  }
}
