import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { CurrentUserId } from '@common/decorators/current-user.decorator';
import { MessageService } from '../services/message.service';
import { SendMessageDto } from '../dto/send-message.dto';
import { MessageResponse } from '../interfaces/message.response';

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
}
