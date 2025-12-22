import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PostService } from '../services/post.service';
import { GetPostsQueryDto } from '../dto/get-posts-query.dto';
import { GetPostsResponseDto } from '../dto/post-response.dto';
import { CurrentUserId } from 'src/common/decorators/current-user.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';

@Controller('posts')
@UseGuards(JwtAuthGuard)
export class PostController {
  constructor(private readonly postService: PostService) {}

  @Get('feed')
  async getFriendsFeed(
    @CurrentUserId() userId: string,
    @Query() query: GetPostsQueryDto,
  ): Promise<GetPostsResponseDto> {
    return this.postService.getPostsFeed(
      userId,
      query.friendIds || [],
      query.limit || 10,
      query.offset || 0,
    );
  }
}
