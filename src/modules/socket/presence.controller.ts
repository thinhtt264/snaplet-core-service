import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { CurrentUserId } from '@common/decorators/current-user.decorator';
import { PresenceService } from './presence.service';
import { RelationshipService } from '@modules/relationships/services/relationship.service';

@Controller('presence')
@UseGuards(JwtAuthGuard)
export class PresenceController {
  constructor(
    private readonly presenceService: PresenceService,
    private readonly relationshipService: RelationshipService,
  ) {}

  @Get('online-friends')
  async getOnlinePartners(@CurrentUserId() userId: string): Promise<string[]> {
    const friendIds = await this.relationshipService.getMyFriendIds(userId);

    return this.presenceService.filterOnlineUserIds(friendIds);
  }
}
