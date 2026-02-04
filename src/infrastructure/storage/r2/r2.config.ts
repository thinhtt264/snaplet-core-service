import { ConfigService } from '@nestjs/config';

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicUrl: string;
  presignedUrlExpiresIn: number;
  imageCdnBaseUrl: string;
}

export const getR2Config = (configService: ConfigService): R2Config => ({
  accountId: configService.get<string>('r2.accountId') || '',
  accessKeyId: configService.get<string>('r2.accessKeyId') || '',
  secretAccessKey: configService.get<string>('r2.secretAccessKey') || '',
  bucket: configService.get<string>('r2.bucket') || '',
  publicUrl: configService.get<string>('r2.publicUrl') || '',
  presignedUrlExpiresIn:
    configService.get<number>('r2.presignedUrlExpiresIn') || 900,
  imageCdnBaseUrl: configService.get<string>('imageCdn.baseUrl') || '',
});
