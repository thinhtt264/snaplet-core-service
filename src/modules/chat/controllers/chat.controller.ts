import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { CurrentUserId } from '@common/decorators/current-user.decorator';
import { ConversationService } from '../services/conversation.service';
import { MessageService } from '../services/message.service';
import { GetConversationsDto } from '../dto/get-conversations.dto';
import { LoadMessagesDto } from '../dto/load-messages.dto';
import {
  ConversationResponse,
  PaginatedConversations,
} from '../interfaces/conversation.response';
import {
  MessageResponse,
  PaginatedMessages,
} from '../interfaces/message.response';
import { CHAT_MESSAGE_PAGE_SIZE } from '@common/constants/chat.constants';

@Controller('conversations')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(
    private readonly conversationService: ConversationService,
    private readonly messageService: MessageService,
  ) {}

  @Get()
  async getConversations(
    @CurrentUserId() userId: string,
    @Query() query: GetConversationsDto,
  ): Promise<PaginatedConversations> {
    return this.conversationService.getConversationList(
      userId,
      query.cursor,
      query.limit,
    );
  }

  @Get(':convId')
  async getConversation(
    @CurrentUserId() userId: string,
    @Param('convId', ParseUUIDPipe) convId: string,
  ): Promise<ConversationResponse> {
    return this.conversationService.getConversationById(convId, userId);
  }

  @Patch(':convId/messages/:messageId/seen')
  @HttpCode(HttpStatus.NO_CONTENT)
  async markMessageSeen(
    @CurrentUserId() userId: string,
    @Param('convId', ParseUUIDPipe) convId: string,
    @Param('messageId') messageId: string,
  ): Promise<void> {
    return this.messageService.markMessageSeen(convId, messageId, userId);
  }

  @Get(':convId/messages')
  async getMessages(
    @CurrentUserId() userId: string,
    @Param('convId', ParseUUIDPipe) convId: string,
    @Query() query: LoadMessagesDto,
  ): Promise<PaginatedMessages> {
    return this.messageService.loadMessages(
      convId,
      userId,
      query.cursor,
      query.limit ?? CHAT_MESSAGE_PAGE_SIZE,
    );
  }

  @Delete(':convId/messages/:messageId')
  @HttpCode(HttpStatus.OK)
  async deleteMessage(
    @CurrentUserId() userId: string,
    @Param('convId', ParseUUIDPipe) convId: string,
    @Param('messageId') messageId: string,
  ): Promise<void> {
    return this.messageService.hardDeleteMessage(convId, messageId, userId);
  }

  @Post(':convId/messages/:messageId/pin')
  @HttpCode(HttpStatus.OK)
  async pinMessage(
    @CurrentUserId() userId: string,
    @Param('convId', ParseUUIDPipe) convId: string,
    @Param('messageId') messageId: string,
  ): Promise<void> {
    return this.messageService.pinMessage(convId, messageId, userId);
  }

  @Delete(':convId/messages/:messageId/pin')
  @HttpCode(HttpStatus.OK)
  async unpinMessage(
    @CurrentUserId() userId: string,
    @Param('convId', ParseUUIDPipe) convId: string,
    @Param('messageId') messageId: string,
  ): Promise<void> {
    return this.messageService.unpinMessage(convId, messageId, userId);
  }

  @Get(':convId/pinned')
  async getPinnedMessages(
    @CurrentUserId() userId: string,
    @Param('convId', ParseUUIDPipe) convId: string,
  ): Promise<MessageResponse[]> {
    return this.messageService.getPinnedMessages(convId, userId);
  }
}
