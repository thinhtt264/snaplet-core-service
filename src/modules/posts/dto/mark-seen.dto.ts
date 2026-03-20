import { IsISO8601 } from 'class-validator';

export class MarkSeenDto {
  @IsISO8601()
  lastSeenPostCreatedAt: string;
}
