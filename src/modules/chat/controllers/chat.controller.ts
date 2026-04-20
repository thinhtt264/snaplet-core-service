import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { CurrentUserId } from '@common/decorators/current-user.decorator';
import { ConversationService } from '../services/conversation.service';
import { MessageService } from '../services/message.service';
import { CreateConversationDto } from '../dto/create-conversation.dto';
import { GetConversationsDto } from '../dto/get-conversations.dto';
import { SendMessageDto } from '../dto/send-message.dto';
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
import { ChatAccessGuard } from '../guards/chat-access.guard';

@Controller('conversations')
@UseGuards(JwtAuthGuard, ChatAccessGuard)
export class ChatController {
  constructor(
    private readonly conversationService: ConversationService,
    private readonly messageService: MessageService,
  ) {}

  @Post()
  async createConversation(
    @CurrentUserId() userId: string,
    @Body() dto: CreateConversationDto,
  ): Promise<ConversationResponse & { isNew: boolean }> {
    const { id, isNew } = await this.conversationService.findOrCreateDirect(
      userId,
      dto.recipientId,
    );

    // Return minimal shape with id + isNew; full list available via GET /conversations
    return { id, isNew } as any;
  }

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

  @Post(':convId/messages')
  @HttpCode(HttpStatus.CREATED)
  async sendMessage(
    @CurrentUserId() userId: string,
    @Param('convId', ParseUUIDPipe) convId: string,
    @Body() dto: SendMessageDto,
  ): Promise<MessageResponse> {
    return this.messageService.send(convId, dto, userId);
  }

  @Delete(':convId/messages/:messageId')
  @HttpCode(HttpStatus.OK)
  async deleteMessage(
    @CurrentUserId() userId: string,
    @Param('messageId') messageId: string,
  ): Promise<void> {
    return this.messageService.softDelete(messageId, userId);
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
