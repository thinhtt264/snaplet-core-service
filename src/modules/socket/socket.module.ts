import { Global, Module } from '@nestjs/common';
import { SocketGateway } from './socket.gateway';
import { SocketService } from './socket.service';
import { PostCreatedListener } from './listeners/post-created.listener';
import { PostsModule } from '@modules/posts/posts.module';
import { RelationshipsModule } from '@modules/relationships/relationships.module';

@Global()
@Module({
  imports: [PostsModule, RelationshipsModule],
  providers: [SocketGateway, SocketService, PostCreatedListener],
  exports: [SocketService],
})
export class SocketModule {}
