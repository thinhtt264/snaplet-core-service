import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { POST_CREATED_EVENT } from '@modules/posts/events/post-events';
import type { PostCreatedEvent } from '@modules/posts/events/post-events';
import { PostsUnreadQueueService } from '../queue/posts-unread.queue.service';

@Injectable()
export class PostEventListener {
  private readonly logger = new Logger(PostEventListener.name);

  constructor(
    private readonly postsUnreadQueueService: PostsUnreadQueueService,
  ) {}

  @OnEvent(POST_CREATED_EVENT)
  async handle(payload: PostCreatedEvent): Promise<void> {
    await this.postsUnreadQueueService
      .enqueuePostCreated(payload.authorId)
      .catch((error) => {
        this.logger.warn(`enqueuePostCreated failed: ${error.message}`);
      });
  }
}
