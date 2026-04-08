import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  REACTION_CREATED_FOR_NOTIFICATION_EVENT,
  type ReactionCreatedNotificationPayload,
} from '../events/notification.events';
import { NotificationQueueService } from '../queue/notification-queue.service';
import { NotificationType } from '../constants/notification.constants';

@Injectable()
export class NotificationListener {
  private readonly logger = new Logger(NotificationListener.name);

  constructor(
    private readonly notificationQueueService: NotificationQueueService,
  ) {}

  @OnEvent(REACTION_CREATED_FOR_NOTIFICATION_EVENT, { async: true })
  async handleReactionCreated(
    payload: ReactionCreatedNotificationPayload,
  ): Promise<void> {
    if (payload.reactorId === payload.postOwnerId) {
      return;
    }

    try {
      await this.notificationQueueService.addReactionPushJob({
        postOwnerId: payload.postOwnerId,
        postId: payload.postId,
        reactorId: payload.reactorId,
        reactorDisplayName: payload.reactorDisplayName,
        actorAvatarUrl: payload.actorAvatarUrl,
        reactionIcon: payload.reactionIcon,
        type: NotificationType.POST_REACTION,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to enqueue reaction push job: ${message}`);
    }
  }
}
