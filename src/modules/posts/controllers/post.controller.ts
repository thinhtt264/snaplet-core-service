import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  MessageEvent,
  Param,
  Post,
  Query,
  Req,
  Sse,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { POST_SSE_EVENTS } from '@common/constants/event-names.constants';
import { PostService } from '../services/post.service';
import { GetPostsQueryDto } from '../dto/get-posts-query.dto';
import { CreatePostDto } from '../dto/create-post.dto';
import { GetPostsResponse } from '../interfaces/post-response.interface';
import { CurrentUserId } from 'src/common/decorators/current-user.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { Observable } from 'rxjs';
import { PostSseService } from '../services/post-sse.service';

@Controller('posts')
@UseGuards(JwtAuthGuard)
export class PostController {
  private readonly logger = new Logger(PostController.name);

  constructor(
    private readonly postService: PostService,
    private readonly postSseService: PostSseService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Get('feed')
  async getPostsFeed(
    @CurrentUserId() userId: string,
    @Query() query: GetPostsQueryDto,
  ): Promise<GetPostsResponse> {
    return await this.postService.getPostsFeed(
      userId,
      query.limit || 10,
      query.cursor,
    );
  }

  @Sse('stream')
  getPostsStream(
    @CurrentUserId() userId: string,
    @Req() req: Request,
  ): Observable<MessageEvent> {
    const connectTime = Date.now();

    this.logger.log(
      `SSE client connected to /posts/stream userId=${userId} at=${new Date(
        connectTime,
      ).toISOString()}`,
    );

    req.on('close', () => {
      const lifetimeMs = Date.now() - connectTime;
      this.logger.log(
        `SSE connection closed for /posts/stream userId=${userId} lifetimeMs=${lifetimeMs}`,
      );
    });

    return this.postSseService.connect(userId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createPost(
    @CurrentUserId() userId: string,
    @Body() dto: CreatePostDto,
  ): Promise<{ id: string; createdAt: Date }> {
    const { mediaIds, caption, visibility } = dto;
    return await this.postService.createPost(
      userId,
      mediaIds,
      caption,
      visibility,
    );
  }

  @Get('unread-count')
  async getUnreadCount(
    @CurrentUserId() userId: string,
  ): Promise<{ count: number }> {
    return this.postService.getUnreadCount(userId);
  }

  @Post('mark-seen')
  @HttpCode(HttpStatus.NO_CONTENT)
  async markSeen(@CurrentUserId() userId: string): Promise<void> {
    await this.postService.markPostsSeen(userId);
  }

  @Delete(':postId')
  @HttpCode(HttpStatus.OK)
  async deletePost(
    @CurrentUserId() userId: string,
    @Param('postId') postId: string,
  ): Promise<void> {
    return await this.postService.deletePost(userId, postId);
  }

  @Post('debug/sse')
  @HttpCode(HttpStatus.OK)
  async debugSse(
    @CurrentUserId() userId: string,
    @Body()
    body: {
      postId?: string;
      authorId?: string;
    },
  ): Promise<{ ok: boolean }> {
    const postId = body.postId || `debug-post-${Date.now()}`;
    const authorId = body.authorId || userId;

    this.logger.log(
      `Debug SSE: emit POST_CREATED event postId=${postId} authorId=${authorId}`,
    );

    this.eventEmitter.emit(POST_SSE_EVENTS.POST_CREATED, {
      postId,
      authorId,
    });

    return { ok: true };
  }
}
