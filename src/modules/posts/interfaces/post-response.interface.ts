export interface PostResponse {
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

export interface GetPostsResponse {
  data: PostResponse[];
  pagination: {
    offset: number;
    limit: number;
  };
}
