import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { RelationshipService } from '../services/relationship.service';
import { CurrentUserId } from 'src/common/decorators/current-user.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import {
  CreateRelationshipDto,
  GetRelationshipWithUserDto,
  GetRelationshipsByStatusQueryDto,
  RelationshipStatusDto,
} from '../dto/relationship.dto';
import {
  RelationshipResponse,
  RelationshipWithOtherUserResponse,
} from '../interfaces/relationship-resonse.interface';

/**
 * Controller for relationship management endpoints
 * All endpoints require JWT authentication
 * Returns enterprise-grade structured responses
 */
@Controller('relationships')
@UseGuards(JwtAuthGuard)
export class RelationshipController {
  constructor(private readonly relationshipService: RelationshipService) {}

  /**
   * Get current user's friend count (accepted relationships).
   * Reuses Redis cache from getMyFriendIds.
   *
   * @example GET /relationships/friends/count
   * @returns { count: number }
   */
  @Get('/friends/count')
  @HttpCode(HttpStatus.OK)
  async getMyFriendCount(
    @CurrentUserId() userId: string,
  ): Promise<{ count: number }> {
    const count = await this.relationshipService.getMyFriendCount(userId);
    return { count };
  }

  /**
   * Get relationships by one or more statuses with other user profiles.
   * One status: GET /relationships?statuses=accepted. Multiple: ?statuses=accepted,pending
   *
   * @example GET /relationships?statuses=accepted,pending
   * @returns List of relationships (merged, sorted by createdAt desc)
   */
  @Get('/')
  @HttpCode(HttpStatus.OK)
  async getRelationshipsWithProfilesByStatuses(
    @CurrentUserId() userId: string,
    @Query() query: GetRelationshipsByStatusQueryDto,
  ): Promise<RelationshipWithOtherUserResponse[]> {
    return this.relationshipService.getRelationshipsWithProfilesByStatuses(
      userId,
      query.statuses,
    );
  }

  /**
   * Get relationship between current user and target user.
   * Body: { targetUserId: string }
   *
   * @example POST /relationships/with-user
   * @returns Relationship if exists, null otherwise
   */
  @Post('/with-user')
  @HttpCode(HttpStatus.OK)
  async getRelationshipWithUser(
    @CurrentUserId() userId: string,
    @Body() body: GetRelationshipWithUserDto,
  ): Promise<RelationshipResponse | null> {
    return this.relationshipService.getRelationshipWithUser(
      userId,
      body.targetUserId,
    );
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUserId() userId: string,
    @Body() body: CreateRelationshipDto,
  ): Promise<RelationshipResponse> {
    return this.relationshipService.create(userId, body.targetUserId);
  }

  @Patch(':relationshipId')
  @HttpCode(HttpStatus.OK)
  async update(
    @CurrentUserId() userId: string,
    @Param('relationshipId') relationshipId: string,
    @Body() body: RelationshipStatusDto,
  ): Promise<RelationshipResponse> {
    return this.relationshipService.update(userId, relationshipId, body.status);
  }

  @Delete(':relationshipId')
  @HttpCode(HttpStatus.OK)
  async delete(
    @CurrentUserId() userId: string,
    @Param('relationshipId') relationshipId: string,
  ): Promise<void> {
    return this.relationshipService.delete(userId, relationshipId);
  }
}
