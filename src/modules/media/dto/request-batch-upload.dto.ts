import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  Min,
  ValidateNested,
  ArrayMinSize,
  Max,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MAX_MEDIA_FILE_SIZE } from 'src/common/constants';
import { IsImageMimeType } from '@common/validators';
import * as MimeTypes from '@common/types/mime-type.types';
import { ImageTransform } from '@common/types';

export class MediaUploadItem {
  @IsNotEmpty()
  @IsImageMimeType()
  mimeType: MimeTypes.ImageMimeType;

  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  @Max(MAX_MEDIA_FILE_SIZE)
  size: number;

  @IsNotEmpty()
  @ValidateNested()
  @Type(() => ImageTransform)
  transform: ImageTransform;
}

export class RequestBatchUploadDto {
  @IsNotEmpty()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => MediaUploadItem)
  items: MediaUploadItem[];
}
