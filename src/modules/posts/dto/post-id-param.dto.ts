import { IsMongoId, IsNotEmpty, IsString } from 'class-validator';

export class PostIdParamDto {
  @IsNotEmpty({ message: 'Post ID is required' })
  @IsString({ message: 'Post ID must be a string' })
  @IsMongoId({ message: 'Post ID must be a valid MongoDB ObjectId' })
  postId: string;
}
