import { Controller, Get, UseGuards } from '@nestjs/common';
import { RelationshipService } from '../services/relationship.service';
import { GetFriendsResponse } from '../interfaces/friend-response.interface';
import { CurrentUserId } from 'src/common/decorators/current-user.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';

@Controller('relationships')
@UseGuards(JwtAuthGuard)
export class RelationshipController {
  constructor(private readonly relationshipService: RelationshipService) {}

  @Get('friends')
  async getFriends(
    @CurrentUserId() userId: string,
  ): Promise<GetFriendsResponse> {
    return this.relationshipService.getFriends(userId);
  }
}
