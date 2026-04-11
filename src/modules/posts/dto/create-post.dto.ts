import {
  IsArray,
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';
import { PostVisibility } from '../schemas/post.schema';
import { MAX_RELATIONSHIPS_PER_USER } from '@common/constants';

export class CreatePostDto {
  @IsNotEmpty()
  @IsArray()
  @ArrayMinSize(1)
  @IsMongoId({ each: true })
  mediaIds: string[];

  @IsOptional()
  @IsString()
  caption?: string;

  @IsOptional()
  @IsEnum(PostVisibility)
  visibility?: PostVisibility;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_RELATIONSHIPS_PER_USER)
  @IsMongoId({ each: true })
  allowedViewerUserIds?: string[];
}
