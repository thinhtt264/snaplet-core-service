import { IsNotEmpty } from 'class-validator';
import { IsValidEmail } from '@common/validators';

export class CheckEmailDto {
  @IsValidEmail({ message: 'Invalid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;
}
