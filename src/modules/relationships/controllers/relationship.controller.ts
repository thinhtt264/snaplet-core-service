import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { RelationshipService } from '../services/relationship.service';
import { CurrentUserId } from 'src/common/decorators/current-user.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import {
  CreateRelationshipDto,
  RelationshipStatusDto,
} from '../dto/relationship.dto';
import { RelationshipStatus } from '../schemas/relationship.schema';
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
   * Get relationships by status with other user profiles (UserBasicInfoResponse).
   *
   * @example GET /relationships/status/accepted
   * @returns List of relationships with populated other user profile
   */
  @Get('/status/:status')
  @HttpCode(HttpStatus.OK)
  async getRelationshipsWithProfilesByStatus(
    @CurrentUserId() userId: string,
    @Param('status') status: RelationshipStatus,
  ): Promise<RelationshipWithOtherUserResponse[]> {
    return this.relationshipService.getRelationshipsWithProfilesByStatus(
      userId,
      status,
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
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @CurrentUserId() userId: string,
    @Param('relationshipId') relationshipId: string,
  ): Promise<void> {
    return this.relationshipService.delete(userId, relationshipId);
  }
}
