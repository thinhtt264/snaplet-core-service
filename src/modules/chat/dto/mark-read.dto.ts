import { IsUUID } from 'class-validator';

export class MarkReadDto {
  @IsUUID()
  conversationId: string;

  @IsUUID()
  messageId: string;
}
