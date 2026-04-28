import {
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export class SendMessageDto {
  @IsUUID()
  clientUuid: string;

  @IsMongoId()
  recipientId: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  text?: string;

  @IsOptional()
  @IsString()
  mediaKey?: string;

  @IsOptional()
  @IsUrl()
  mediaUrl?: string;

  // Required when mediaUrl is present; mediaKey-backed uploads infer mimeType from Media.
  @ValidateIf((o) => o.mediaKey != null || o.mediaUrl != null)
  @IsString()
  mimeType?: string;

  @ValidateIf((o) => o.mediaKey != null || o.mediaUrl != null)
  @IsInt()
  @Min(1)
  width?: number;

  @ValidateIf((o) => o.mediaKey != null || o.mediaUrl != null)
  @IsInt()
  @Min(1)
  height?: number;

  @IsOptional()
  @IsUUID()
  replyToId?: string;
}
