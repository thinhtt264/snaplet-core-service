import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  CHAT_MESSAGE_REACTED_EVENT,
  CHAT_MESSAGE_SENT_EVENT,
  type ChatMessageReactedEvent,
  type ChatMessageSentEvent,
} from '@modules/chat/events/chat-notification.events';
import {
  FRIEND_REQUEST_CREATED_NOTIFICATION_EVENT,
  type FriendRequestCreatedNotificationPayload,
  REACTION_CREATED_FOR_NOTIFICATION_EVENT,
  type ReactionCreatedNotificationPayload,
} from '../events/notification.events';
import { NotificationQueueService } from '../queue/notification-queue.service';
import { NotificationType } from '../constants/notification.constants';
import { buildFriendRequestDeeplink } from '@common/utils';

@Injectable()
export class NotificationListener {
  private readonly logger = new Logger(NotificationListener.name);

  constructor(
    private readonly notificationQueueService: NotificationQueueService,
  ) {}

  @OnEvent(CHAT_MESSAGE_SENT_EVENT, { async: true })
  async handleChatMessageSent(event: ChatMessageSentEvent): Promise<void> {
    try {
      await this.notificationQueueService.addChatFcmJob({
        recipientUserId: event.recipientUserId,
        payload: {
          type: NotificationType.NEW_CHAT_MESSAGE,
          conversationId: event.conversationId,
          messageId: event.messageId,
          senderUserId: event.senderUserId,
          text: event.text ?? undefined,
          hasImage: event.hasImage,
        },
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to enqueue chat message push job: ${message}`);
    }
  }

  @OnEvent(CHAT_MESSAGE_REACTED_EVENT, { async: true })
  async handleChatMessageReacted(
    event: ChatMessageReactedEvent,
  ): Promise<void> {
    try {
      await this.notificationQueueService.addChatFcmJob({
        recipientUserId: event.recipientUserId,
        payload: {
          type: NotificationType.NEW_MESSAGE_REACTION,
          conversationId: event.conversationId,
          messageId: event.messageId,
          reactorUserId: event.reactorUserId,
          emoji: event.emoji,
        },
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to enqueue chat reaction push job: ${message}`);
    }
  }

  @OnEvent(FRIEND_REQUEST_CREATED_NOTIFICATION_EVENT, { async: true })
  async handleFriendRequestCreated(
    payload: FriendRequestCreatedNotificationPayload,
  ): Promise<void> {
    try {
      await this.notificationQueueService.addCustomPushJob({
        recipientUserId: payload.targetUserId,
        deeplink: buildFriendRequestDeeplink(payload.initiatorUsername ?? ''),
        title: `${payload.initiatorDisplayName} sent you a friend request`,
        body: 'Tap to open app',
        largeIconUrl: payload.initiatorAvatarUrl,
        type: NotificationType.CUSTOM,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to enqueue friend request push job: ${message}`,
      );
    }
  }

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
        deeplink: payload.deeplink,
        reactorId: payload.reactorId,
        reactorDisplayName: payload.reactorDisplayName,
        largeIconUrl: payload.largeIconUrl,
        reactionIcon: payload.reactionIcon,
        type: NotificationType.CUSTOM,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to enqueue reaction push job: ${message}`);
    }
  }
}
