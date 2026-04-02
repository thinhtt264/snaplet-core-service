export const RELATIONSHIP_DELETED_EVENT = 'relationship.deleted';

export interface RelationshipDeletedEvent {
  user1Id: string;
  user2Id: string;
}
