import { Injectable } from '@nestjs/common';
import {
  PutObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { R2Client } from './r2.client';
import {
  ImageSizeKey,
  IMAGE_SIZE_CONFIGS,
  ImageUrls,
} from '@common/types/image-transform.types';

@Injectable()
export class R2StorageService {
  constructor(private readonly r2Client: R2Client) {}

  async generatePresignedUploadUrl(
    key: string,
    mimeType?: string,
    expiresIn?: number,
  ): Promise<string> {
    const client = this.r2Client.getClient();
    const bucket = this.r2Client.getBucket();
    const defaultExpiresIn = this.r2Client.getPresignedUrlExpiresIn();

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: mimeType,
    });

    return getSignedUrl(client, command, {
      expiresIn: expiresIn ?? defaultExpiresIn,
    });
  }

  getPresignedUrlExpiresIn(): number {
    return this.r2Client.getPresignedUrlExpiresIn();
  }

  /**
   * Generate public URL from key (original URL without CDN transformation)
   * Pattern: ${publicUrl}/${key}
   */
  getDefaultImageUrl(key: string | undefined | null): string {
    if (!key) return '';
    const imageCdnBaseUrl = this.r2Client.getImageCdnBaseUrl();
    return `${imageCdnBaseUrl}/${key}`;
  }

  /**
   * Extract storage key from either a default image URL
   * or a resized CDN URL.
   *
   * Works for:
   * - ${cdnBaseUrl}/${key}
   * - ${cdnBaseUrl}/cdn-cgi/image/.../${cdnBaseUrl}/${key}
   */
  getKeyFromImageUrl(url: string | undefined | null): string | null {
    if (!url) return null;
    const imageCdnBaseUrl = this.r2Client.getImageCdnBaseUrl();
    const marker = `${imageCdnBaseUrl}/`;

    const lastIndex = url.lastIndexOf(marker);
    if (lastIndex === -1) {
      return null;
    }

    return url.substring(lastIndex + marker.length);
  }

  /**
   * Generate CDN URL with dynamic width and height
   * Pattern: ${cdnBaseUrl}/cdn-cgi/image/w=${width},h=${height}/${cdnBaseUrl}/${key}
   */
  getCdnUrl(key: string, width: number, height: number): string {
    if (!key) return '';
    const cdnBaseUrl = this.r2Client.getImageCdnBaseUrl();
    return `${cdnBaseUrl}/cdn-cgi/image/w=${width},h=${height}/${cdnBaseUrl}/${key}`;
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
    if (!key) return null;

    const sizesToGenerate = sizes ?? Object.values(ImageSizeKey);

    const result: ImageUrls = {};

    for (const size of sizesToGenerate) {
      const config = IMAGE_SIZE_CONFIGS[size];
      if (config) {
        result[size] = this.getCdnUrl(key, config.width, config.height);
      }
    }
    return result;
  }

  /**
   * Get real file size from R2 storage
   * @param key - Storage key (e.g., "imageV1/{mediaId}")
   * @returns File size in bytes
   */
  async getRealFileSize(key: string): Promise<number> {
    const client = this.r2Client.getClient();
    const bucket = this.r2Client.getBucket();

    const command = new HeadObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const response = await client.send(command);
    return response.ContentLength || 0;
  }

  /**
   * Delete file from R2 storage
   * @param key - Storage key (e.g., "imageV1/{mediaId}")
   * @returns true if deleted successfully, false if file doesn't exist
   */
  async deleteFile(key: string): Promise<boolean> {
    const client = this.r2Client.getClient();
    const bucket = this.r2Client.getBucket();

    try {
      const command = new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      });

      await client.send(command);
      return true;
    } catch (error: any) {
      if (error.name === 'NoSuchKey' || error.name === 'NotFound') {
        return true;
      }
      throw error;
    }
  }
}
