export class PostResponseDto {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  imageUrl: string;
  caption: string;
  visibility: string;
  createdAt: Date;
  isOwnPost: boolean;
}

export class GetPostsResponseDto {
  data: PostResponseDto[];
  pagination: {
    total: number;
    offset: number;
    limit: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}
