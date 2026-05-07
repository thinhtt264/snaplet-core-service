import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { CurrentUserId } from '@common/decorators/current-user.decorator';
import { MessageService } from '../services/message.service';
import { SendMessageDto } from '../dto/send-message.dto';
import {
  MessageReactionResponse,
  MessageResponse,
} from '../interfaces/message.response';
import { ReactToMessageDto } from '../dto/react-to-message.dto';

@Controller('messages')
@UseGuards(JwtAuthGuard)
export class MessageController {
  constructor(private readonly messageService: MessageService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async sendMessage(
    @CurrentUserId() userId: string,
    @Body() dto: SendMessageDto,
  ): Promise<MessageResponse> {
    return this.messageService.send(dto, userId);
  }

  @Post(':messageId/reactions')
  @HttpCode(HttpStatus.OK)
  async reactToMessage(
    @CurrentUserId() userId: string,
    @Param('messageId') messageId: string,
    @Body() dto: ReactToMessageDto,
  ): Promise<MessageReactionResponse[]> {
    return await this.messageService.reactToMessage(
      messageId,
      userId,
      dto.emoji,
    );
  }

  @Delete(':messageId/reactions')
  @HttpCode(HttpStatus.OK)
  async removeReaction(
    @CurrentUserId() userId: string,
    @Param('messageId') messageId: string,
  ): Promise<void> {
    return this.messageService.removeMessageReaction(messageId, userId);
  }

  @Get(':messageId/reactions')
  async getMessageReactions(
    @CurrentUserId() userId: string,
    @Param('messageId') messageId: string,
  ): Promise<MessageReactionResponse[]> {
    return this.messageService.getMessageReactions(messageId, userId);
  }
}
