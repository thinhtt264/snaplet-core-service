import type { RelationshipStatus } from '@modules/relationships/schemas/relationship.schema';
import type { UserBasicInfoResponse } from './user-response.interface';

/**
 * HTTP response item for GET /users/search.
 * Kept separate from {@link RelationshipWithOtherUserResponse} (relationships list).
 */
export interface SearchUserItemResponse extends UserBasicInfoResponse {
  /** Relationship document id; null if none */
  id: string | null;
  status: RelationshipStatus | null;
  createdAt: Date | null;
  /** Who initiated the relationship request; null if no relationship */
  initiator: string | null;
}
