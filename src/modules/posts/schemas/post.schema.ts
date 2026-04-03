import { AbstractDocument } from '@database/abstract.schema';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

export enum PostVisibility {
  FRIEND_ONLY = 'friend-only',
  PUBLIC = 'public',
}

@Schema({ collection: 'posts', timestamps: true })
export class Post extends AbstractDocument {
  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  userId: Types.ObjectId;

  @Prop({
    required: true,
    type: [{ type: Types.ObjectId, ref: 'Media' }],
  })
  mediaIds: Types.ObjectId[];

  @Prop({ default: '' })
  caption: string;

  @Prop({
    required: true,
    enum: PostVisibility,
    default: PostVisibility.FRIEND_ONLY,
  })
  visibility: PostVisibility;

  @Prop({ default: false })
  isOwnerViewedPost: boolean;
}

export const PostSchema = SchemaFactory.createForClass(Post);

// Index for filtering by userIds with cursor pagination
PostSchema.index(
  { userId: 1, createdAt: -1, _id: -1 },
  {
    partialFilterExpression: { isDeleted: { $ne: true } },
    name: 'idx_userId_createdAt_id_active',
  },
);

// Compound index for cursor pagination (used in $sort stage)
PostSchema.index(
  { createdAt: -1, _id: -1 },
  {
    partialFilterExpression: { isDeleted: { $ne: true } },
    name: 'idx_createdAt_id_active',
  },
);
