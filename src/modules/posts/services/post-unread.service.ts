import { Injectable } from '@nestjs/common';
import { RelationshipService } from '@modules/relationships/services/relationship.service';
import { RedisService } from '@common/redis/redis.service';
import { buildRedisKey } from '@common/utils/redis.utils';
import { REDIS_KEY_FEATURES } from '@common/constants/redis-keys.constants';
import { SocketService } from '@modules/socket/socket.service';
import { CacheService } from '@modules/cache/cache.service';
import {
  DEFAULT_CACHE_POST_TTL,
  POST_SESSION_STATE_TTL_SECONDS,
  POST_UNREAD_COUNT_MAX,
} from '../constants/post-unread.constants';
import { POSTS_UNREAD_UPDATED_EVENT } from '@modules/socket/events/socket-events';

@Injectable()
export class PostUnreadService {
  constructor(
    private readonly relationshipService: RelationshipService,
    private readonly redisService: RedisService,
    private readonly socketService: SocketService,
    private readonly cacheService: CacheService,
  ) {}

  async handleUserConnected(userId: string, sessionId: string): Promise<void> {
    const stateKey = this.getSessionStateKey(userId);
    const currentSessionId = await this.redisService.hget(
      stateKey,
      'sessionId',
    );

    if (currentSessionId === sessionId) {
      await this.redisService.expire(stateKey, POST_SESSION_STATE_TTL_SECONDS);
      return;
    }

    await this.redisService.multiExec(
      async (multi) => {
        multi.hset(stateKey, 'sessionId', sessionId);
        multi.hset(stateKey, 'seq', '0');
        multi.expire(stateKey, POST_SESSION_STATE_TTL_SECONDS);
        return multi.exec();
      },
      null,
      'handleUserConnected',
    );
  }

  async incrementUnreadForUser(
    userId: string,
  ): Promise<{ count: number; seq: number }> {
    const stateKey = this.getSessionStateKey(userId);
    const sessionId = await this.redisService.hget(stateKey, 'sessionId');
    if (!sessionId) {
      return { count: 0, seq: 0 };
    }

    const countKey = buildRedisKey(
      REDIS_KEY_FEATURES.POST_UNREAD_COUNT_CACHE,
      userId,
    );
    const results = await this.redisService.multiExec(
      async (multi) => {
        multi.incr(countKey);
        multi.expire(countKey, DEFAULT_CACHE_POST_TTL);
        multi.hincrby(stateKey, 'seq', 1);
        multi.expire(stateKey, POST_SESSION_STATE_TTL_SECONDS);
        return multi.exec();
      },
      null,
      'incrementUnreadForUser',
    );

    if (!results) {
      return { count: 0, seq: 0 };
    }

    const count = Number(results[0]?.[1] ?? 0);
    const seq = Number(results[2]?.[1] ?? 0);
    return { count, seq };
  }

  async applyMarkSeen(
    userId: string,
    lastSeenPostCreatedAt: string,
  ): Promise<void> {
    await this.cacheService.set(
      REDIS_KEY_FEATURES.POST_UNREAD_LAST_SEEN_CACHE,
      userId,
      lastSeenPostCreatedAt,
      DEFAULT_CACHE_POST_TTL,
    );

    const countKey = buildRedisKey(
      REDIS_KEY_FEATURES.POST_UNREAD_COUNT_CACHE,
      userId,
    );
    const stateKey = this.getSessionStateKey(userId);
    const sessionId = await this.redisService.hget(stateKey, 'sessionId');
    if (!sessionId) {
      await this.cacheService.set(
        REDIS_KEY_FEATURES.POST_UNREAD_COUNT_CACHE,
        userId,
        0,
        DEFAULT_CACHE_POST_TTL,
      );
      return;
    }

    const results = await this.redisService.multiExec(
      async (multi) => {
        multi.set(countKey, '0', 'EX', DEFAULT_CACHE_POST_TTL);
        multi.hincrby(stateKey, 'seq', 1);
        multi.expire(stateKey, POST_SESSION_STATE_TTL_SECONDS);
        return multi.exec();
      },
      null,
      'applyMarkSeen',
    );
    if (!results) {
      return;
    }

    const seq = Number(results[1]?.[1] ?? 0);
    this.socketService.emitToUser(userId, POSTS_UNREAD_UPDATED_EVENT, {
      count: 0,
      seq,
    });
  }

  async applyPostDeleteSideEffects(authorId: string): Promise<void> {
    const friendIds = await this.relationshipService.getMyFriendIds(authorId);
    if (!friendIds.length) {
      return;
    }

    await Promise.all(
      friendIds.map(async (friendId) => {
        const countKey = buildRedisKey(
          REDIS_KEY_FEATURES.POST_UNREAD_COUNT_CACHE,
          friendId,
        );
        const stateKey = this.getSessionStateKey(friendId);
        const sessionId = await this.redisService.hget(stateKey, 'sessionId');
        if (!sessionId) {
          return;
        }

        const results = await this.redisService.multiExec(
          async (multi) => {
            multi.decr(countKey);
            multi.expire(countKey, DEFAULT_CACHE_POST_TTL);
            multi.hincrby(stateKey, 'seq', 1);
            multi.expire(stateKey, POST_SESSION_STATE_TTL_SECONDS);
            return multi.exec();
          },
          null,
          'applyPostDeleteSideEffects',
        );
        if (!results) {
          return;
        }

        const count = Number(results[0]?.[1] ?? 0);
        const seq = Number(results[2]?.[1] ?? 0);
        if (count < 0) {
          await this.cacheService.set(
            REDIS_KEY_FEATURES.POST_UNREAD_COUNT_CACHE,
            friendId,
            0,
            DEFAULT_CACHE_POST_TTL,
          );
          return;
        }

        if (seq <= 0) {
          return;
        }

        this.socketService.emitToUser(friendId, POSTS_UNREAD_UPDATED_EVENT, {
          count: Math.min(count, POST_UNREAD_COUNT_MAX),
          seq,
        });
      }),
    );
  }

  private getSessionStateKey(userId: string): string {
    return buildRedisKey(REDIS_KEY_FEATURES.POST_SESSION_STATE, userId);
  }
}
