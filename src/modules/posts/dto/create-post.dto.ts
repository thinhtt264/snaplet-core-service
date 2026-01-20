import {
  IsArray,
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  ArrayMinSize,
} from 'class-validator';
import { PostVisibility } from '../schemas/post.schema';

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
}
