import { USER_PROFILE_FIELD_MAX_LENGTH } from '@common/constants';
import { IsValidUserName } from '@common/validators';
import { IsNotEmpty, MaxLength } from 'class-validator';

export class CheckUsernameDto {
  @IsValidUserName()
  @MaxLength(USER_PROFILE_FIELD_MAX_LENGTH, {
    message: `Username must be at most ${USER_PROFILE_FIELD_MAX_LENGTH} characters`,
  })
  @IsNotEmpty({ message: 'Username is required' })
  username: string;
}
