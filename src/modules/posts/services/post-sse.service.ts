import { Injectable, Logger, MessageEvent } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { SseEventType } from '@common/constants/sse-event-type.constants';

type PostsUpdatePayload = {
  seq: number;
  count: number;
};

@Injectable()
export class PostSseService {
  private readonly connections = new Map<string, Subject<MessageEvent>>();
  private readonly logger = new Logger(PostSseService.name);

  // Per-connection TTL: 3 hours (in milliseconds)
  private static readonly FORCE_RECONNECT_MS = 3 * 60 * 60 * 1000;

  connect(userId: string): Observable<MessageEvent> {
    const old = this.connections.get(userId);
    if (old) {
      old.complete();
    }

    const subject = new Subject<MessageEvent>();
    this.connections.set(userId, subject);

    return new Observable<MessageEvent>((subscriber) => {
      const heartbeat = setInterval(() => {
        try {
          subscriber.next({
            type: SseEventType.PING,
            data: '',
          } as MessageEvent);
        } catch (err) {
          this.logger.error(
            `Failed to emit ping event for userId=${userId}`,
            err instanceof Error ? err.stack : undefined,
          );
        }
      }, 30_000);

      const forceReconnectTimer = setTimeout(() => {
        try {
          subscriber.next({
            type: SseEventType.POSTS_RECONNECT,
            data: '',
          } as MessageEvent);
        } catch (err) {
          this.logger.error(
            `Failed to emit posts_reconnect event for userId=${userId}`,
            err instanceof Error ? err.stack : undefined,
          );
        } finally {
          subscriber.complete();
        }
      }, PostSseService.FORCE_RECONNECT_MS);

      const cleanup = () => {
        clearInterval(heartbeat);
        clearTimeout(forceReconnectTimer);
      };

      const subscription = subject.subscribe(subscriber);

      return () => {
        cleanup();
        subscription.unsubscribe();
        this.handleDisconnect(userId, subject);
      };
    });
  }

  hasConnection(userId: string): boolean {
    return this.connections.has(userId);
  }

  emitPostsUpdate(
    userId: string,
    type: SseEventType,
    payload: PostsUpdatePayload,
  ): void {
    const subject = this.connections.get(userId);
    if (!subject) {
      return;
    }

    subject.next({
      data: JSON.stringify(payload),
      type,
    } as MessageEvent);
  }

  private handleDisconnect(
    userId: string,
    subject: Subject<MessageEvent>,
  ): void {
    if (this.connections.get(userId) === subject) {
      subject.complete();
      this.connections.delete(userId);

      this.logger.log(`SSE disconnected for /posts/stream userId=${userId}`);
    }
  }
}
