import { IsMongoId } from 'class-validator';

export class CreateConversationDto {
  @IsMongoId({ message: 'Invalid recipientId' })
  recipientId: string;
}
