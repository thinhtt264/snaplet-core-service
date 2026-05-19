import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';

export class ReactToMessageDto {
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  emoji!: string;
}
