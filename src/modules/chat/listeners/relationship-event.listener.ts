import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  RELATIONSHIP_DELETED_EVENT,
  RELATIONSHIP_ACCEPTED_EVENT,
} from '@modules/relationships/events/relationship-events';
import type {
  RelationshipDeletedEvent,
  RelationshipAcceptedEvent,
} from '@modules/relationships/events/relationship-events';
import { ConversationService } from '../services/conversation.service';
import { ChatGateway } from '../gateway/chat.gateway';
import {
  CONVERSATION_RESTRICTED,
  CONVERSATION_UNRESTRICTED,
} from '../events/chat-socket-events';

@Injectable()
export class RelationshipEventListener {
  private readonly logger = new Logger(RelationshipEventListener.name);

  constructor(
    private readonly conversationService: ConversationService,
    private readonly chatGateway: ChatGateway,
  ) {}

  @OnEvent(RELATIONSHIP_DELETED_EVENT)
  async handleRelationshipDeleted(
    payload: RelationshipDeletedEvent,
  ): Promise<void> {
    try {
      const conv = await this.conversationService.restrictConversation(
        payload.user1Id,
        payload.user2Id,
      );
      if (conv) {
        this.chatGateway.broadcastToRoom(conv.id, CONVERSATION_RESTRICTED, {
          conversationId: conv.id,
        });
      }
    } catch (error: any) {
      this.logger.warn(
        `handleRelationshipDeleted failed: ${error?.message ?? 'unknown error'}`,
      );
    }
  }

  @OnEvent(RELATIONSHIP_ACCEPTED_EVENT)
  async handleRelationshipAccepted(
    payload: RelationshipAcceptedEvent,
  ): Promise<void> {
    try {
      const conv = await this.conversationService.unrestrictConversation(
        payload.user1Id,
        payload.user2Id,
      );
      if (conv) {
        this.chatGateway.broadcastToRoom(conv.id, CONVERSATION_UNRESTRICTED, {
          conversationId: conv.id,
        });
      }
    } catch (error: any) {
      this.logger.warn(
        `handleRelationshipAccepted failed: ${error?.message ?? 'unknown error'}`,
      );
    }
  }
}
