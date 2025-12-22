import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { RelationshipService } from '../services/relationship.service';
import { CurrentUserId } from 'src/common/decorators/current-user.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import {
  CreateRelationshipDto,
  UpdateRelationshipStatusDto,
} from '../dto/relationship.dto';
import {
  Relationship,
  RelationshipStatus,
} from '../schemas/relationship.schema';
import { GetRelationshipsResponse } from '../interfaces/relationship-resonse.interface';

@Controller('relationships')
@UseGuards(JwtAuthGuard)
export class RelationshipController {
  constructor(private readonly relationshipService: RelationshipService) {}

  @Get('/status/:status')
  async getRelationshipsByStatus(
    @CurrentUserId() userId: string,
    @Param('status') status: RelationshipStatus,
  ): Promise<GetRelationshipsResponse[]> {
    return this.relationshipService.getRelationshipsByStatus(userId, status);
  }

  @Post()
  async create(
    @CurrentUserId() userId: string,
    @Body() body: CreateRelationshipDto,
  ): Promise<Relationship> {
    return this.relationshipService.create(userId, body.targetUserId);
  }

  @Patch(':relationshipId')
  update(
    @CurrentUserId() userId: string,
    @Param('relationshipId') relationshipId: string,
    @Body() body: UpdateRelationshipStatusDto,
  ) {
    return this.relationshipService.update(userId, relationshipId, body.status);
  }

  @Delete(':relationshipId')
  delete(
    @CurrentUserId() userId: string,
    @Param('relationshipId') relationshipId: string,
  ) {
    return this.relationshipService.delete(userId, relationshipId);
  }
}
