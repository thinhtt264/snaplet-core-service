export const RELATIONSHIP_DELETED_EVENT = 'relationship.deleted';
export const RELATIONSHIP_ACCEPTED_EVENT = 'relationship.accepted';

export interface RelationshipDeletedEvent {
  user1Id: string;
  user2Id: string;
}

export interface RelationshipAcceptedEvent {
  user1Id: string;
  user2Id: string;
}
