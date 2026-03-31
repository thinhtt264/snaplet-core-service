import { AbstractDocument } from '@database/abstract.schema';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

@Schema({ collection: 'post_reactions', timestamps: true })
export class PostReaction extends AbstractDocument {
  @Prop({ required: true, type: Types.ObjectId, ref: 'Post' })
  postId: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  reactorUserId: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  postOwnerUserId: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 128 })
  reactionIcon: string;
}

export const PostReactionSchema = SchemaFactory.createForClass(PostReaction);

PostReactionSchema.index(
  { postId: 1, reactorUserId: 1 },
  {
    unique: true,
    partialFilterExpression: { isDeleted: { $ne: true } },
    name: 'uidx_post_reactor_active',
  },
);

PostReactionSchema.index(
  { postId: 1, updatedAt: -1, _id: -1 },
  {
    partialFilterExpression: { isDeleted: { $ne: true } },
    name: 'idx_post_updated_id_active',
  },
);
