import { IsNotEmpty, IsString } from 'class-validator';
import { IsValidEmail } from '@common/validators';

export class LoginDto {
  @IsValidEmail({ message: 'Invalid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @IsString({ message: 'Password must be a string' })
  @IsNotEmpty({ message: 'Password is required' })
  password: string;
}
