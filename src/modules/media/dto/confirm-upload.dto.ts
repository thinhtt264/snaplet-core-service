import { IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator';

export class ConfirmUploadDto {
  @IsNotEmpty()
  @IsString()
  mediaId: string;

  @IsNotEmpty()
  @IsUrl()
  originalUrl: string;

  @IsOptional()
  @IsUrl()
  thumbnailUrl?: string;

  @IsOptional()
  width?: number;

  @IsOptional()
  height?: number;

  @IsOptional()
  duration?: number;
}
