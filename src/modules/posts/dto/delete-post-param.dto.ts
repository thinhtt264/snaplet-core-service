import { IsMongoId, IsNotEmpty, IsString } from 'class-validator';

export class DeletePostParamDto {
  @IsNotEmpty({ message: 'Post ID is required' })
  @IsString({ message: 'Post ID must be a string' })
  @IsMongoId({ message: 'Post ID must be a valid MongoDB ObjectId' })
  postId: string;
}
