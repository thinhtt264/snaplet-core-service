import { IsMongoId } from 'class-validator';

export class GetConversationIdDto {
  @IsMongoId()
  targetUserId!: string;
}
