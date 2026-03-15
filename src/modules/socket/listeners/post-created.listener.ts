import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { SocketService } from '../socket.service';
import { PostService } from '@modules/posts/services/post.service';
import { RelationshipService } from '@modules/relationships/services/relationship.service';
import { POST_CREATED_EVENT } from '@modules/posts/events/post-events';
import type { PostCreatedEvent } from '@modules/posts/events/post-events';

const NEW_POST_EVENT = 'new_post';

@Injectable()
export class PostCreatedListener {
  constructor(
    private readonly socketService: SocketService,
    private readonly postService: PostService,
    private readonly relationshipService: RelationshipService,
  ) {}

  @OnEvent(POST_CREATED_EVENT)
  async handle(payload: PostCreatedEvent): Promise<void> {
    const friendIds = await this.relationshipService.getMyFriendIds(
      payload.authorId,
    );
    await Promise.all(
      friendIds.map(async (friendId) => {
        const { count, seq } =
          await this.postService.incrSessionUnread(friendId);
        this.socketService.emitToUser(friendId, NEW_POST_EVENT, { count, seq });
      }),
    );
  }
}
