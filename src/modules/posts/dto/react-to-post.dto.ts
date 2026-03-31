import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ReactToPostDto {
  @IsNotEmpty({ message: 'Reaction icon is required' })
  @IsString({ message: 'Reaction icon must be a string' })
  @MaxLength(32, { message: 'Reaction icon is too long' })
  reactionIcon: string;
}
