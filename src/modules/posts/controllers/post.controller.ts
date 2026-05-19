import {
  Controller,
  Get,
  Post,
  Patch,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Delete,
  Param,
} from '@nestjs/common';
import { PostService } from '../services/post.service';
import { GetPostsQueryDto } from '../dto/get-posts-query.dto';
import { CreatePostDto } from '../dto/create-post.dto';
import { MarkSeenDto } from '../dto/mark-seen.dto';
import { PostIdParamDto } from '../dto/post-id-param.dto';
import {
  GetPostsResponse,
  PostActivityResponse,
  PostResponse,
} from '../interfaces/post-response.interface';
import {
  GetPostReactionsResponse,
  PostReactionResponse,
} from '../interfaces/post-reaction-response.interface';
import { GetNewerFeedDto } from '../dto/get-newer-feed.dto';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { CurrentUserId } from '@common/decorators/current-user.decorator';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { ReactToPostDto } from '../dto/react-to-post.dto';

@Controller('posts')
@UseGuards(JwtAuthGuard)
export class PostController {
  constructor(private readonly postService: PostService) {}

  @Get('unread-count')
  async getUnreadCount(
    @CurrentUserId() userId: string,
  ): Promise<{ count: number }> {
    return this.postService.unreadCount(userId);
  }

  @Post('mark-seen')
  @HttpCode(HttpStatus.OK)
  markSeen(@CurrentUserId() userId: string, @Body() dto: MarkSeenDto): void {
    return this.postService.markSeen(userId, dto.lastSeenPostCreatedAt);
  }

  @Patch(':postId/owner-viewed')
  @HttpCode(HttpStatus.OK)
  async markOwnerViewedPost(
    @CurrentUserId() userId: string,
    @Param() params: PostIdParamDto,
  ): Promise<void> {
    return this.postService.ownerViewedPost(userId, params.postId);
  }

  @Get('feed/newer')
  @HttpCode(HttpStatus.OK)
  async getNewerFeed(
    @CurrentUserId() userId: string,
    @Query() dto: GetNewerFeedDto,
  ): Promise<PostResponse[]> {
    return this.postService.getNewerFeed(userId, dto);
  }

  @Get('feed')
  async getPostsFeed(
    @CurrentUserId() userId: string,
    @Query() query: GetPostsQueryDto,
  ): Promise<GetPostsResponse> {
    let filterUserIds: string[] | undefined;
    if (query.userIds?.length) {
      filterUserIds = query.userIds;
    } else if (query.userId) {
      filterUserIds = [query.userId];
    }

    return await this.postService.getPostsFeed(
      userId,
      query.limit || 10,
      query.cursor,
      filterUserIds,
    );
  }

  @Get('activity')
  @HttpCode(HttpStatus.OK)
  async getPostsActivity(
    @CurrentUserId() userId: string,
  ): Promise<PostActivityResponse | null> {
    return this.postService.getPostsActivity(userId);
  }

  @Get(':postId')
  @HttpCode(HttpStatus.OK)
  async getPostById(
    @CurrentUserId() userId: string,
    @Param() params: PostIdParamDto,
  ): Promise<PostResponse> {
    return this.postService.getPostById(userId, params.postId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createPost(
    @CurrentUserId() userId: string,
    @Body() dto: CreatePostDto,
  ): Promise<{ id: string; createdAt: Date }> {
    const { mediaIds, caption, visibility, allowedViewerUserIds } = dto;
    return await this.postService.createPost(
      userId,
      mediaIds,
      caption,
      visibility,
      allowedViewerUserIds,
    );
  }

  @Delete(':postId')
  @HttpCode(HttpStatus.OK)
  async deletePost(
    @CurrentUserId() userId: string,
    @Param() params: PostIdParamDto,
  ): Promise<void> {
    return await this.postService.deletePost(userId, params.postId);
  }

  @Patch(':postId/reactions')
  @UseGuards(ThrottlerGuard)
  @Throttle({
    default: {
      limit: 15,
      ttl: 30_000,
    },
  })
  @HttpCode(HttpStatus.OK)
  async reactToPost(
    @CurrentUserId() userId: string,
    @Param() params: PostIdParamDto,
    @Body() dto: ReactToPostDto,
  ): Promise<PostReactionResponse> {
    return this.postService.reactToPost(
      userId,
      params.postId,
      dto.reactionIcon,
    );
  }

  /**
   * Remove current user's reaction from a post.
   */
  @Delete(':postId/reactions')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deletePostReaction(
    @CurrentUserId() userId: string,
    @Param() params: PostIdParamDto,
  ): Promise<void> {
    return this.postService.removePostReaction(userId, params.postId);
  }

  /**
   * Owner-only endpoint: list all users who reacted to a post (basic profile + reaction).
   * Does not return aggregate reaction counts.
   */
  @Get(':postId/reactions')
  @HttpCode(HttpStatus.OK)
  async getPostReactions(
    @CurrentUserId() userId: string,
    @Param() params: PostIdParamDto,
  ): Promise<GetPostReactionsResponse> {
    return this.postService.getPostReactions(userId, params.postId);
  }
}
