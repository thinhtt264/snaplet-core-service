import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { BaseRequest } from '@common/types/request.types';
import { RelationshipService } from '@modules/relationships/services/relationship.service';
import { RelationshipStatus } from '@modules/relationships/schemas/relationship.schema';
import { ConversationService } from '../services/conversation.service';

@Injectable()
export class ChatAccessGuard implements CanActivate {
  constructor(
    private readonly relationshipService: RelationshipService,
    private readonly conversationService: ConversationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() === 'ws') {
      return this.handleWs(context);
    }
    return this.handleHttp(context);
  }

  // ─── HTTP ────────────────────────────────────────────────────────────────

  private async handleHttp(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<BaseRequest>();
    const userId = request.user!.userId;
    const convId = request.params?.convId as string | undefined;

    if (convId) {
      return this.assertMember(convId, userId);
    }

    // POST /conversations — kiểm tra bạn bè trước khi tạo
    const recipientId = request.body?.recipientId as string | undefined;
    if (recipientId) {
      return this.assertFriends(userId, recipientId);
    }

    return true;
  }

  // ─── WebSocket ───────────────────────────────────────────────────────────

  private async handleWs(context: ExecutionContext): Promise<boolean> {
    const client = context
      .switchToWs()
      .getClient<Socket & { userId: string }>();
    const data = context.switchToWs().getData<{ conversationId?: string }>();

    const userId = client.userId;
    const convId = data?.conversationId;

    if (convId) {
      const isMember = await this.conversationService.isMember(convId, userId);
      if (!isMember) throw new WsException('Not a member of this conversation');
      return true;
    }

    return true;
  }

  // ─── Shared helpers ──────────────────────────────────────────────────────

  private async assertMember(convId: string, userId: string): Promise<boolean> {
    const isMember = await this.conversationService.isMember(convId, userId);
    if (!isMember) {
      throw new ForbiddenException('Not a member of this conversation');
    }
    return true;
  }

  private async assertFriends(
    userId: string,
    recipientId: string,
  ): Promise<boolean> {
    const relationship = await this.relationshipService.getRelationshipWithUser(
      userId,
      recipientId,
    );
    if (relationship?.status !== RelationshipStatus.ACCEPTED) {
      throw new ForbiddenException(
        'You can only message users who are your friends',
      );
    }
    return true;
  }
}
