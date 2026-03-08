import { IsNotEmpty, IsNumber, Max, Min } from 'class-validator';
import { IsImageMimeType } from '@common/validators';
import * as MimeTypes from '@common/types/mime-type.types';
import { MAX_AVATAR_FILE_SIZE } from '@common/constants';

export class RequestAvatarUploadDto {
  @IsNotEmpty()
  @IsImageMimeType()
  mimeType: MimeTypes.ImageMimeType;

  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  @Max(MAX_AVATAR_FILE_SIZE)
  size: number;
}
