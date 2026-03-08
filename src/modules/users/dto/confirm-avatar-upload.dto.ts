import { IsNotEmpty, IsString } from 'class-validator';

export class ConfirmAvatarUploadDto {
  @IsString()
  @IsNotEmpty()
  key: string;
}
