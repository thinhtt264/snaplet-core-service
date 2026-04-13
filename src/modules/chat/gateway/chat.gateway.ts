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
import { Injectable, Logger } from '@nestjs/common';
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
import { ConversationRepository } from '../repositories/conversation.repository';

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

  // Lazily set after module init to break circular dependency (services → gateway → services)
  private typingService: {
    start(c: string, u: string): Promise<void>;
    stop(c: string, u: string): Promise<void>;
  } | null = null;
  private readReceiptService: {
    markRead(c: string, u: string, m: string): Promise<void>;
  } | null = null;
  private conversationRepo: ConversationRepository | null = null;

  constructor(
    private readonly jwtService: JwtService,
    private readonly redis: RedisService,
  ) {}

  setTypingService(service: {
    start(c: string, u: string): Promise<void>;
    stop(c: string, u: string): Promise<void>;
  }): void {
    this.typingService = service;
  }

  setReadReceiptService(service: {
    markRead(c: string, u: string, m: string): Promise<void>;
  }): void {
    this.readReceiptService = service;
  }

  setConversationRepository(repo: ConversationRepository): void {
    this.conversationRepo = repo;
  }

  afterInit(): void {
    this.server.use(this.createAuthMiddleware());
  }

  handleConnection(client: Socket & { userId?: string }): void {
    if (!client.userId) {
      client.disconnect();
    }
    this.logger.debug(`Chat WS connected, userId=${client.userId}`);
  }

  handleDisconnect(client: Socket & { userId?: string }): void {
    this.logger.debug(`Chat WS disconnected, userId=${client.userId}`);
  }

  @SubscribeMessage(CHAT_JOIN_CONVERSATION)
  async handleJoin(
    @ConnectedSocket() client: Socket & { userId: string },
    @MessageBody() payload: { conversationId: string },
  ): Promise<void> {
    if (!this.conversationRepo) return;
    const member = await this.conversationRepo.getMember(
      payload.conversationId,
      client.userId,
    );
    if (!member) return;
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
    if (this.typingService) {
      await this.typingService.start(payload.conversationId, client.userId);
    }
  }

  @SubscribeMessage(CHAT_TYPING_STOP)
  async handleTypingStop(
    @ConnectedSocket() client: Socket & { userId: string },
    @MessageBody() payload: { conversationId: string },
  ): Promise<void> {
    if (this.typingService) {
      await this.typingService.stop(payload.conversationId, client.userId);
    }
  }

  @SubscribeMessage(CHAT_MARK_READ)
  async handleMarkRead(
    @ConnectedSocket() client: Socket & { userId: string },
    @MessageBody() payload: { conversationId: string; messageId: string },
  ): Promise<void> {
    if (this.readReceiptService) {
      await this.readReceiptService.markRead(
        payload.conversationId,
        client.userId,
        payload.messageId,
      );
    }
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
