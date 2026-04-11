import { AbstractDocument } from '@database/abstract.schema';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { MAX_RELATIONSHIPS_PER_USER } from '@common/constants';

export enum PostVisibility {
  FRIEND_ONLY = 'friend-only',
  ME_ONLY = 'me-only',
  SELECTED_USERS = 'selected-users',
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

  @Prop({
    type: [{ type: Types.ObjectId, ref: 'User' }],
    default: undefined,
    validate: {
      validator: (value?: Types.ObjectId[]) =>
        !value || value.length <= MAX_RELATIONSHIPS_PER_USER,
      message: `allowedViewerUserIds must have at most ${MAX_RELATIONSHIPS_PER_USER} items`,
    },
  })
  allowedViewerUserIds?: Types.ObjectId[];

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
