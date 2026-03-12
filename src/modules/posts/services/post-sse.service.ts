import { Injectable, MessageEvent } from '@nestjs/common';
import { RedisService } from '@common/redis/redis.service';
import { Observable, Subject } from 'rxjs';
import { REDIS_KEY_FEATURES } from '@common/constants/redis-keys.constants';

type PostsUpdatePayload = {
  type: 'posts_update';
  seq: number;
  count: number;
};

@Injectable()
export class PostSseService {
  private readonly connections = new Map<string, Subject<MessageEvent>>();

  constructor(private readonly redisService: RedisService) {}

  /**
   * Establish SSE connection for a user.
   * Handles onConnect and wires onDisconnect into the Observable lifecycle.
   */
  connect(userId: string): Observable<MessageEvent> {
    let subject = this.connections.get(userId);
    if (!subject) {
      subject = new Subject<MessageEvent>();
      this.connections.set(userId, subject);
    }

    // onConnect: reset session-scoped unread and seq counters for this user
    void this.redisService.del([
      `${REDIS_KEY_FEATURES.POSTS_SESSION_UNREAD}:${userId}`,
      `${REDIS_KEY_FEATURES.POSTS_SESSION_SEQ}:${userId}`,
    ]);

    return new Observable<MessageEvent>((subscriber) => {
      const subscription = subject.subscribe(subscriber);

      return () => {
        subscription.unsubscribe();
        this.handleDisconnect(userId);
      };
    });
  }

  /**
   * Check if a user currently has an active SSE connection.
   */
  hasConnection(userId: string): boolean {
    return this.connections.has(userId);
  }

  /**
   * Emit a posts_update event to a specific user if they are connected.
   */
  emitPostsUpdate(userId: string, payload: PostsUpdatePayload): void {
    const subject = this.connections.get(userId);
    if (!subject) {
      return;
    }

    subject.next({
      data: JSON.stringify(payload),
    } as MessageEvent);
  }

  /**
   * Internal disconnect handler to clean up connection and Redis keys.
   */
  private handleDisconnect(userId: string): void {
    const subject = this.connections.get(userId);
    if (subject) {
      subject.complete();
      this.connections.delete(userId);
    }

    // onDisconnect: reset session-scoped unread and seq counters
    void this.redisService.del([
      `${REDIS_KEY_FEATURES.POSTS_SESSION_UNREAD}:${userId}`,
      `${REDIS_KEY_FEATURES.POSTS_SESSION_SEQ}:${userId}`,
    ]);
  }
}
