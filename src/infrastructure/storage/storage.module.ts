import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { R2Client } from './r2/r2.client';
import { R2StorageService } from './r2/r2.storage.service';
import { StorageService } from './storage.service';

@Module({
  imports: [ConfigModule],
  providers: [R2Client, R2StorageService, StorageService],
  exports: [StorageService],
})
export class StorageModule {}
