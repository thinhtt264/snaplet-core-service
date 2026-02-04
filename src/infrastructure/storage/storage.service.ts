import { Injectable } from '@nestjs/common';
import { R2StorageService } from './r2/r2.storage.service';
import { ImageUrls, ImageSizeKey } from '@common/types/image-transform.types';

@Injectable()
export class StorageService {
  constructor(private readonly r2StorageService: R2StorageService) {}

  async generatePresignedUploadUrl(
    key: string,
    mimeType?: string,
    expiresIn?: number,
  ): Promise<string> {
    return this.r2StorageService.generatePresignedUploadUrl(
      key,
      mimeType,
      expiresIn,
    );
  }

  getPresignedUrlExpiresIn(): number {
    return this.r2StorageService.getPresignedUrlExpiresIn();
  }

  getPublicUrlFromKey(key: string | undefined | null): string {
    return this.r2StorageService.getPublicUrlFromKey(key);
  }

  /**
   * Generate image size URLs for a given key
   * @param key - Storage key
   * @param sizes - Optional array of sizes to include. If not provided, returns all sizes.
   */
  getImageUrls(
    key: string | undefined | null,
    sizes?: ImageSizeKey[],
  ): ImageUrls | null {
    return this.r2StorageService.getImageUrls(key, sizes);
  }

  /**
   * Get real file size from storage
   * @param key - Storage key (e.g., "imageV1/{mediaId}")
   * @returns File size in bytes
   */
  async getRealFileSize(key: string): Promise<number> {
    return this.r2StorageService.getRealFileSize(key);
  }

  /**
   * Delete file from storage
   * @param key - Storage key (e.g., "imageV1/{mediaId}")
   * @returns true if deleted successfully, false if file doesn't exist
   */
  async deleteFile(key: string): Promise<boolean> {
    return this.r2StorageService.deleteFile(key);
  }
}
