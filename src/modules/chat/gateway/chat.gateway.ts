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
  CHAT_MARK_READ,
  CHAT_TYPING_START,
  CHAT_TYPING_STOP,
} from '../events/chat-socket-events';
import { TypingService } from '../services/typing.service';
import { ReadReceiptService } from '../services/read-receipt.service';
import { ConversationService } from '../services/conversation.service';

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
      void client.join(`conv:${conversationId}`);
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
    client.join(`conv:${payload.conversationId}`);
  }

  @SubscribeMessage(CHAT_LEAVE_CONVERSATION)
  handleLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId: string },
  ): void {
    client.leave(`conv:${payload.conversationId}`);
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

  @SubscribeMessage(CHAT_MARK_READ)
  async handleMarkRead(
    @ConnectedSocket() client: Socket & { userId: string },
    @MessageBody() payload: { conversationId: string; messageId: string },
  ): Promise<void> {
    const isMember = await this.conversationService.isMember(
      payload.conversationId,
      client.userId,
    );
    if (!isMember) return;
    await this.readReceiptService.markRead(
      payload.conversationId,
      client.userId,
      payload.messageId,
    );
  }

  broadcastToRoom(convId: string, event: string, payload: unknown): void {
    this.server.to(`conv:${convId}`).emit(event, payload);
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
        next();
      } catch {
        this.logger.warn('Chat WS connection rejected: invalid token');
        next(new Error('Unauthorized'));
      }
    };
  }
}
