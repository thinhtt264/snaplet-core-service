import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Delete,
  Param,
  Sse,
  MessageEvent,
} from '@nestjs/common';
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
  constructor(
    private readonly postService: PostService,
    private readonly postSseService: PostSseService,
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
  getPostsStream(@CurrentUserId() userId: string): Observable<MessageEvent> {
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
}
