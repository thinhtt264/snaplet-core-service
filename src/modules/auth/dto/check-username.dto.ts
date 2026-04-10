import { IsValidUserName } from '@common/validators';
import { IsNotEmpty } from 'class-validator';

export class CheckUsernameDto {
  @IsValidUserName()
  @IsNotEmpty({ message: 'Username is required' })
  username: string;
}
