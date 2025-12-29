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
   * Get relationships by status with other user details
   * Returns flattened response structure that extends UserBasicInfoResponse
   *
   * @example GET /relationships/status/accepted
   * @returns List of relationships with populated other user information
   */
  @Get('/status/:status')
  @HttpCode(HttpStatus.OK)
  async getRelationshipsByStatus(
    @CurrentUserId() userId: string,
    @Param('status') status: RelationshipStatus,
  ): Promise<RelationshipWithOtherUserResponse[]> {
    return this.relationshipService.getRelationshipsByStatus(userId, status);
  }

  /**
   * Create a new relationship request
   * Creates relationship in PENDING status
   *
   * @example POST /relationships
   * @body { targetUserId: "507f1f77bcf86cd799439011" }
   * @returns Created relationship document
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUserId() userId: string,
    @Body() body: CreateRelationshipDto,
  ): Promise<RelationshipResponse> {
    return this.relationshipService.create(userId, body.targetUserId);
  }

  /**
   * Update relationship status
   * Can be used to accept, reject, or block a relationship
   *
   * @example PATCH /relationships/507f1f77bcf86cd799439011
   * @body { status: "accepted" }
   * @returns Updated relationship document
   */
  @Patch(':relationshipId')
  @HttpCode(HttpStatus.OK)
  async update(
    @CurrentUserId() userId: string,
    @Param('relationshipId') relationshipId: string,
    @Body() body: RelationshipStatusDto,
  ): Promise<RelationshipResponse> {
    return this.relationshipService.update(userId, relationshipId, body.status);
  }

  /**
   * Delete a relationship
   * Removes the relationship completely from the system
   *
   * @example DELETE /relationships/507f1f77bcf86cd799439011
   * @returns No content
   */
  @Delete(':relationshipId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @CurrentUserId() userId: string,
    @Param('relationshipId') relationshipId: string,
  ): Promise<void> {
    return this.relationshipService.delete(userId, relationshipId);
  }
}
