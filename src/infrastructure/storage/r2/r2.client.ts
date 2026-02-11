import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client } from '@aws-sdk/client-s3';
import { getR2Config } from './r2.config';

@Injectable()
export class R2Client {
  private readonly client: S3Client;
  private readonly config: ReturnType<typeof getR2Config>;

  constructor(private readonly configService: ConfigService) {
    this.config = getR2Config(configService);
    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${this.config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: this.config.accessKeyId,
        secretAccessKey: this.config.secretAccessKey,
      },
    });
  }

  getClient(): S3Client {
    return this.client;
  }

  getBucket(): string {
    return this.config.bucket;
  }

  getPresignedUrlExpiresIn(): number {
    return this.config.presignedUrlExpiresIn;
  }

  getImageCdnBaseUrl(): string {
    return this.config.publicUrl;
  }
}
