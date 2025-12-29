export interface IUserProfileResponse {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  avatarUrl: string;
  createdAt: Date;
}

export interface UserBasicInfoResponse {
  userId: string;
  username: string;
  firstName: string;
  lastName: string;
  avatarUrl: string;
}
