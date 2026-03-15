import { Module } from '@nestjs/common';
import { DebugController } from './debug.controller';
import { SocketModule } from '@modules/socket/socket.module';
import { PostsModule } from '@modules/posts/posts.module';

@Module({
  imports: [SocketModule, PostsModule],
  controllers: [DebugController],
})
export class DebugModule {}
