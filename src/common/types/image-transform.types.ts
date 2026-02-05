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

/**
 * Image size presets for profile images
 * Each preset has a specific width x height and aspect ratio
 */
export enum ImageSizeKey {
  XS = 'xs', // 64x64 (1:1) - Thumbnail / Icon
  SM = 'sm', // 256x256 (1:1) - Preview / Avatar
  MD = 'md', // 512x512 (1:1) - Standard Square
  XL = 'xl', // 768x768 (1:1) - High-Res Square
}

export interface ImageSizeConfig {
  width: number;
  height: number;
}

export const IMAGE_SIZE_CONFIGS: Record<ImageSizeKey, ImageSizeConfig> = {
  [ImageSizeKey.XS]: { width: 64, height: 64 },
  [ImageSizeKey.SM]: { width: 256, height: 256 },
  [ImageSizeKey.MD]: { width: 512, height: 512 },
  [ImageSizeKey.XL]: { width: 768, height: 768 },
};

/**
 * Image URLs - partial object with requested sizes only
 */
export type ImageUrls = Partial<Record<ImageSizeKey, string>>;
