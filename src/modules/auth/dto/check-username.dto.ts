import { IsNotEmpty, IsString } from 'class-validator';

export class CheckUsernameDto {
  @IsString({ message: 'Username must be a string' })
  @IsNotEmpty({ message: 'Username is required' })
  username: string;
}
