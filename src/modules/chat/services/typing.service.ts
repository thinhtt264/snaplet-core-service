import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { RedisService } from '@common/redis/redis.service';
import { TYPING_KEY, TYPING_TTL_MS } from '@common/constants/chat.constants';
import {
  CHAT_TYPING_START_EVT,
  CHAT_TYPING_STOP_EVT,
} from '../events/chat-socket-events';
import { ChatGateway } from '../gateway/chat.gateway';

@Injectable()
export class TypingService {
  constructor(
    private readonly redis: RedisService,
    @Inject(forwardRef(() => ChatGateway))
    private readonly gateway: ChatGateway,
  ) {}

  async start(convId: string, userId: string): Promise<void> {
    await this.redis.set(
      TYPING_KEY(convId, userId),
      '1',
      Math.ceil(TYPING_TTL_MS / 1000),
    );
    this.gateway.broadcastToRoom(convId, CHAT_TYPING_START_EVT, { userId });
  }

  async stop(convId: string, userId: string): Promise<void> {
    await this.redis.del(TYPING_KEY(convId, userId));
    this.gateway.broadcastToRoom(convId, CHAT_TYPING_STOP_EVT, { userId });
  }
}
