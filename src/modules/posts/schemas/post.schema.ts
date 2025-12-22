import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { AbstractDocument } from '../../../database/abstract.schema';

export enum PostVisibility {
  FRIEND_ONLY = 'friend-only',
  ALL = 'all',
}

@Schema({ collection: 'posts', timestamps: true })
export class Post extends AbstractDocument {
  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  userId: Types.ObjectId;

  @Prop({ required: true })
  imageUrl: string;

  @Prop({ default: '' })
  caption: string;

  @Prop({
    required: true,
    enum: PostVisibility,
    default: PostVisibility.FRIEND_ONLY,
  })
  visibility: PostVisibility;
}

export const PostSchema = SchemaFactory.createForClass(Post);

PostSchema.index(
  { userId: 1, createdAt: -1 },
  {
    partialFilterExpression: { isDeleted: { $ne: true } },
    name: 'idx_userId_createdAt_active',
  },
);

PostSchema.index(
  { createdAt: -1 },
  {
    partialFilterExpression: { isDeleted: { $ne: true } },
    name: 'idx_createdAt_active',
  },
);
