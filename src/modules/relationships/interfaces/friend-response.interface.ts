export interface Friend {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  relationshipId: string;
  createdAt: Date;
}

export interface GetFriendsResponse {
  data: Friend[];
  total: number;
}
