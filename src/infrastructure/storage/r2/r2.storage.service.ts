import { Injectable } from '@nestjs/common';
import {
  PutObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { R2Client } from './r2.client';

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
   * Generate public URL from key
   * Pattern: ${publicUrl}/${key}
   */
  getPublicUrlFromKey(key: string | undefined | null): string {
    if (!key) return '';
    const publicUrl = this.r2Client.getPublicUrl();
    return `${publicUrl}/${key}`;
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
