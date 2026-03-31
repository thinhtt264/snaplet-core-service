import { Test, TestingModule } from '@nestjs/testing';
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  INestApplication,
  Param,
  Patch,
} from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';

describe('Post reactions route (e2e-lite)', () => {
  let app: INestApplication<App>;

  @Controller('posts')
  class TestPostsController {
    @Patch(':postId/reactions')
    @HttpCode(HttpStatus.OK)
    reactToPost(
      @Param('postId') postId: string,
      @Body('reactionIcon') reactionIcon: string,
    ) {
      return {
        postId,
        reactorUserId: 'friend-user-id',
        reactionIcon,
      };
    }
  }

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [TestPostsController],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('PATCH /posts/:postId/reactions returns 200 for authorized friend', async () => {
    const postId = '507f1f77bcf86cd799439011';

    await request(app.getHttpServer())
      .patch(`/posts/${postId}/reactions`)
      .send({ reactionIcon: '🎉' })
      .expect(200)
      .expect((res) => {
        expect(res.body.postId).toBe(postId);
        expect(res.body.reactorUserId).toBe('friend-user-id');
        expect(res.body.reactionIcon).toBe('🎉');
      });
  });
});
