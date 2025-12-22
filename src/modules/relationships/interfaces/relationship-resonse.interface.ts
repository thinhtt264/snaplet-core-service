import { RelationshipStatus } from '../schemas/relationship.schema';

export interface GetRelationshipsResponse {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  relationshipId: string;
  createdAt: Date;
  status: RelationshipStatus;
}
