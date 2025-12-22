import { IsArray, IsMongoId, IsOptional, IsInt, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class GetPostsQueryDto {
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  @Transform(({ value }) => {
    // Handle both comma-separated string and array
    if (typeof value === 'string') {
      return value.split(',').filter((id) => id.trim());
    }
    return Array.isArray(value) ? value : [];
  })
  friendIds?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}
