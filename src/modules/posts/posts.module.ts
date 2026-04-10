import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Post, PostSchema } from './schemas/post.schema';
import {
  PostReaction,
  PostReactionSchema,
} from './schemas/post-reaction.schema';
import { PostController } from './controllers/post.controller';
import { PostService } from './services/post.service';
import { PostAudienceService } from './services/post-audience.service';
import { PostUnreadService } from './services/post-unread.service';
import { PostRepository } from './repositories/post.repository';
import { PostReactionRepository } from './repositories/post-reaction.repository';
import { UserConnectedListener } from './listeners/user-connected.listener';
import { PostEventListener } from './listeners/post-event.listener';
import { RelationshipEventListener } from './listeners/relationship-event.listener';
import { MediaModule } from '../media/media.module';
import { RelationshipsModule } from '../relationships/relationships.module';
import { UsersModule } from '../users/users.module';
import { StorageModule } from '@infrastructure/storage/storage.module';
import { PostsUnreadQueueService } from './queue/posts-unread.queue.service';
import { PostsUnreadProcessor } from './queue/posts-unread.processor';
import { NotificationsModule } from '@modules/notifications/notifications.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Post.name, schema: PostSchema },
      { name: PostReaction.name, schema: PostReactionSchema },
    ]),
    MediaModule,
    RelationshipsModule,
    UsersModule,
    StorageModule,
    NotificationsModule,
  ],
  controllers: [PostController],
  providers: [
    PostService,
    PostAudienceService,
    PostUnreadService,
    PostsUnreadQueueService,
    PostsUnreadProcessor,
    PostRepository,
    PostReactionRepository,
    UserConnectedListener,
    PostEventListener,
    RelationshipEventListener,
  ],
  exports: [PostService],
})
export class PostsModule {}
