import { IsNotEmpty } from 'class-validator';
import { IsValidUserName } from '@common/validators';

export class CheckUsernameDto {
  @IsValidUserName({
    message: 'Username must contain only letters, numbers, and underscores',
  })
  @IsNotEmpty({ message: 'Username is required' })
  username: string;
}
