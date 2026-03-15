import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { SOCKET_USER_CONNECTED } from '@modules/socket/events/socket-events';
import type { UserConnectedEvent } from '@modules/socket/events/socket-events';
import { PostService } from '../services/post.service';

@Injectable()
export class UserConnectedListener {
  constructor(private readonly postService: PostService) {}

  @OnEvent(SOCKET_USER_CONNECTED)
  async handle(payload: UserConnectedEvent): Promise<void> {
    await this.postService.deleteSessionUnread(payload.userId);
  }
}
