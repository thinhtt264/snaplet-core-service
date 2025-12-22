export class FriendDto {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  relationshipId: string;
  createdAt: Date; // Thời điểm kết bạn
}

export class GetFriendsResponseDto {
  data: FriendDto[];
  total: number;
}
