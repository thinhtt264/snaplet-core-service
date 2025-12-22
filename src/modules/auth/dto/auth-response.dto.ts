export class AuthResponseDto {
  accessToken: string;
  user: {
    id: string;
    email: string;
    username: string;
    firstName: string;
    lastName: string;
    avatarUrl: string;
  };
}
