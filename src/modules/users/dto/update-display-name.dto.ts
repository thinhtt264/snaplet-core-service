import { USER_PROFILE_FIELD_MAX_LENGTH } from '@common/constants';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UpdateDisplayNameDto {
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
}
