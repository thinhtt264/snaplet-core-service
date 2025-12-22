import { Controller, Get, UseGuards } from '@nestjs/common';
import { RelationshipService } from '../services/relationship.service';
import { GetFriendsResponseDto } from '../dto/friend-response.dto';
import { CurrentUserId } from 'src/common/decorators/current-user.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';

@Controller('relationships')
@UseGuards(JwtAuthGuard)
export class RelationshipController {
  constructor(private readonly relationshipService: RelationshipService) {}

  @Get('friends')
  async getFriends(
    @CurrentUserId() userId: string,
  ): Promise<GetFriendsResponseDto> {
    return this.relationshipService.getFriends(userId);
  }
}
