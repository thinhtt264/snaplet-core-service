import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { SocketService } from '@modules/socket/socket.service';
import { PostService } from '@modules/posts/services/post.service';

const NEW_POST_EVENT = 'new_post';
const DEFAULT_DEBUG_USER_ID = '6965e21d1a259d10c7be1726'; // meo@gmail.com

@Controller('debug')
@UseGuards(JwtAuthGuard)
export class DebugController {
  constructor(
    private readonly socketService: SocketService,
    private readonly postService: PostService,
  ) {}

  /**
   * Emit new_post event to a user (for testing WS).
   * Default userId = meo@gmail.com. Incr session unread then emit.
   */
  @Post('emit-new-post')
  @HttpCode(HttpStatus.OK)
  async emitNewPost(
    @Body() body: { userId?: string },
  ): Promise<{ ok: boolean; userId: string; count: number; seq: number }> {
    const userId = body?.userId ?? DEFAULT_DEBUG_USER_ID;
    const { count, seq } = await this.postService.incrSessionUnread(userId);
    this.socketService.emitToUser(userId, NEW_POST_EVENT, { count, seq });
    return { ok: true, userId, count, seq };
  }
}
