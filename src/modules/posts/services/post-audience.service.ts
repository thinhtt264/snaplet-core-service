import { Injectable } from '@nestjs/common';
import { PostVisibility } from '../schemas/post.schema';
import { RelationshipService } from '@modules/relationships/services/relationship.service';

@Injectable()
export class PostAudienceService {
  constructor(private readonly relationshipService: RelationshipService) {}

  async resolveRecipientUserIds(params: {
    authorId: string;
    visibility: PostVisibility;
    allowedViewerUserIds?: Array<string | { toString(): string }>;
  }): Promise<string[]> {
    const { authorId, visibility, allowedViewerUserIds } = params;

    switch (visibility) {
      case PostVisibility.FRIEND_ONLY:
        return this.relationshipService.getMyFriendIds(authorId);
      case PostVisibility.SELECTED_USERS: {
        if (!allowedViewerUserIds?.length) {
          return [];
        }

        return Array.from(
          new Set(allowedViewerUserIds.map((id) => id.toString())),
        );
      }
      case PostVisibility.ME_ONLY:
      default:
        return [];
    }
  }
}
