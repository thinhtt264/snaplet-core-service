import { Type } from 'class-transformer';
import {
  IsISO8601,
  IsInt,
  IsNotEmpty,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export class GetNewerFeedDto {
  @IsISO8601()
  @IsNotEmpty()
  since: string; // ISO timestamp of newest friend post client has

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  @Type(() => Number)
  limit: number = 1;
}
