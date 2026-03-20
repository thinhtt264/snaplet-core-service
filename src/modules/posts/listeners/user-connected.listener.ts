import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { SOCKET_USER_CONNECTED } from '@modules/socket/events/socket-events';
import type { UserConnectedEvent } from '@modules/socket/events/socket-events';
import { PostService } from '../services/post.service';

@Injectable()
export class UserConnectedListener {
  private readonly logger = new Logger(UserConnectedListener.name);

  constructor(private readonly postService: PostService) {}

  @OnEvent(SOCKET_USER_CONNECTED)
  handleUserConnected({ userId, sessionId }: UserConnectedEvent): void {
    this.postService.handleUserConnected(userId, sessionId).catch((err) => {
      this.logger.error(`handleUserConnected failed: ${err.message}`);
    });
  }
}
