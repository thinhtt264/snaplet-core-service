import { IsUUID } from 'class-validator';

export class MarkSeenDto {
  @IsUUID()
  messageId: string;
}
