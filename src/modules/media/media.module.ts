import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Media, MediaSchema } from './schemas/media.schema';
import { MediaController } from './controllers/media.controller';
import { MediaService } from './services/media.service';
import { MediaRepository } from './repositories/media.repository';
import { MediaCleanupService } from './services/media-cleanup.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Media.name, schema: MediaSchema }]),
  ],
  controllers: [MediaController],
  providers: [MediaService, MediaRepository, MediaCleanupService],
  exports: [MediaService, MediaRepository],
})
export class MediaModule {}
