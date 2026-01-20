import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PostService } from '../services/post.service';
import { GetPostsQueryDto } from '../dto/get-posts-query.dto';
import { CreatePostDto } from '../dto/create-post.dto';
import { GetPostsResponse } from '../interfaces/post-response.interface';
import { CurrentUserId } from 'src/common/decorators/current-user.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';

@Controller('posts')
@UseGuards(JwtAuthGuard)
export class PostController {
  constructor(private readonly postService: PostService) {}

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
}
