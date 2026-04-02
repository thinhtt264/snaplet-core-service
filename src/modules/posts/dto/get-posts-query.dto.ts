import {
  IsOptional,
  IsInt,
  IsString,
  IsArray,
  Min,
  Max,
  IsMongoId,
} from 'class-validator';
import { Type } from 'class-transformer';

export class GetPostsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  limit?: number;

  @IsOptional()
  @IsString()
  cursor?: string; // base64 encoded cursor for pagination

  @IsOptional()
  @IsString({ message: 'User ID must be a string' })
  @IsMongoId({ message: 'User ID must be a valid MongoDB ObjectId' })
  userId?: string;

  @IsOptional()
  @IsArray({ message: 'userIds must be an array' })
  @Type(() => String)
  @IsMongoId({
    each: true,
    message: 'Each userId must be a valid MongoDB ObjectId',
  })
  userIds?: string[];
}
