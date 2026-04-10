import { USER_PROFILE_FIELD_MAX_LENGTH } from '@common/constants';
import { IsValidEmail, IsValidUserName } from '@common/validators';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @IsValidEmail({ message: 'Invalid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @IsValidUserName()
  @MaxLength(USER_PROFILE_FIELD_MAX_LENGTH, {
    message: `Username must be at most ${USER_PROFILE_FIELD_MAX_LENGTH} characters`,
  })
  @IsNotEmpty({ message: 'Username is required' })
  username: string;

  @IsString({ message: 'First name must be a string' })
  @MaxLength(USER_PROFILE_FIELD_MAX_LENGTH, {
    message: `First name must be at most ${USER_PROFILE_FIELD_MAX_LENGTH} characters`,
  })
  @IsNotEmpty({ message: 'First name is required' })
  firstName: string;

  @IsString({ message: 'Last name must be a string' })
  @MaxLength(USER_PROFILE_FIELD_MAX_LENGTH, {
    message: `Last name must be at most ${USER_PROFILE_FIELD_MAX_LENGTH} characters`,
  })
  @IsNotEmpty({ message: 'Last name is required' })
  lastName: string;

  @IsString({ message: 'Password must be a string' })
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password: string;
}
