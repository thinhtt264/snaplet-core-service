import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Post, PostSchema } from './schemas/post.schema';
import { PostController } from './controllers/post.controller';
import { PostService } from './services/post.service';
import { PostRepository } from './repositories/post.repository';
import { MediaModule } from '../media/media.module';
import { RelationshipsModule } from '../relationships/relationships.module';
import { StorageModule } from '@infrastructure/storage/storage.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Post.name, schema: PostSchema }]),
    MediaModule,
    RelationshipsModule,
    StorageModule,
  ],
  controllers: [PostController],
  providers: [PostService, PostRepository],
})
export class PostsModule {}
