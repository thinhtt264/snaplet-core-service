import {
  IsArray,
  IsMongoId,
  IsOptional,
  IsInt,
  IsString,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class GetPostsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @IsOptional()
  @IsString()
  cursor?: string; // base64 encoded cursor for pagination
}
