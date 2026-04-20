import { IsMongoId } from 'class-validator';

export class CreateConversationDto {
  @IsMongoId()
  recipientId: string;
}
