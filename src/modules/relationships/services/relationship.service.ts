import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { Types } from 'mongoose';
import { RelationshipRepository } from '../repositories/relationship.repository';
import { GetFriendsResponseDto, FriendDto } from '../dto/friend-response.dto';

@Injectable()
export class RelationshipService {
  constructor(
    private readonly relationshipRepository: RelationshipRepository,
  ) {}

  /**
   * Lấy danh sách bạn bè của user
   * Client sẽ cache list này để reuse khi refresh feed
   */
  async getFriends(userId: string): Promise<GetFriendsResponseDto> {
    try {
      const userObjectId = new Types.ObjectId(userId);

      const friendsData =
        await this.relationshipRepository.findAcceptedFriendsWithUserInfo(
          userObjectId,
        );

      const friends: FriendDto[] = friendsData.map((item) => ({
        id: item.friendId.toString(),
        username: item.friend?.username || '',
        displayName: item.friend?.displayName || '',
        avatarUrl: item.friend?.avatarUrl || '',
        relationshipId: item._id.toString(),
        createdAt: item.createdAt,
      }));

      return {
        data: friends,
        total: friends.length,
      };
    } catch (error) {
      throw new InternalServerErrorException(
        error.message || 'Failed to fetch friends',
      );
    }
  }
}
