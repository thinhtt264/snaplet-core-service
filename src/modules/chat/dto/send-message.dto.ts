import {
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class SendMessageDto {
  @IsUUID()
  clientUuid: string;

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

  // Required when mediaKey or mediaUrl is present
  @ValidateIf((o) => o.mediaKey != null || o.mediaUrl != null)
  @IsString()
  mimeType?: string;

  @IsOptional()
  @IsInt()
  width?: number;

  @IsOptional()
  @IsInt()
  height?: number;

  @IsOptional()
  @IsUUID()
  replyToId?: string;
}
