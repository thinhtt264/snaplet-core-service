import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  Min,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MediaType } from '../schemas/media.schema';

export class MediaUploadItem {
  @IsNotEmpty()
  @IsEnum(MediaType)
  type: MediaType;

  @IsNotEmpty()
  mimeType: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  size: number;
}

export class RequestBatchUploadDto {
  @IsNotEmpty()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => MediaUploadItem)
  items: MediaUploadItem[];
}
