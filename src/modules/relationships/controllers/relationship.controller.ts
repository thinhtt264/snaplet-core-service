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
  RelationshipIdParamDto,
  RelationshipStatusDto,
} from '../dto/relationship.dto';
import {
  RelationshipCountResponse,
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
   * Accepted friend count and incoming pending friend-request count.
   * Friends: MY_FRIEND_IDS cache; pending: RELATIONSHIPS with incoming-only suffix.
   *
   * @example GET /relationships/count
   * @returns RelationshipCountResponse
   */
  @Get('/count')
  @HttpCode(HttpStatus.OK)
  async getRelationshipCount(
    @CurrentUserId() userId: string,
  ): Promise<RelationshipCountResponse> {
    return this.relationshipService.getRelationshipCount(userId);
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
    @Param() params: RelationshipIdParamDto,
    @Body() body: RelationshipStatusDto,
  ): Promise<RelationshipResponse> {
    return this.relationshipService.update(
      userId,
      params.relationshipId,
      body.status,
    );
  }

  @Delete(':relationshipId')
  @HttpCode(HttpStatus.OK)
  async delete(
    @CurrentUserId() userId: string,
    @Param() params: RelationshipIdParamDto,
  ): Promise<void> {
    return this.relationshipService.delete(userId, params.relationshipId);
  }
}
