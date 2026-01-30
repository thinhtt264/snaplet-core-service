import { IsInt, IsNumber, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class ImageTransform {
  @IsInt()
  @Type(() => Number)
  rotation: number;

  @IsNumber()
  @IsIn([1, -1])
  @Type(() => Number)
  scaleX: number; // 1 or -1

  @IsNumber()
  @IsIn([1, -1])
  @Type(() => Number)
  scaleY: number; // 1 or -1
}
