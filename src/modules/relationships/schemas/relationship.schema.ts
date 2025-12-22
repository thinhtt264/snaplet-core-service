import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { AbstractDocument } from '../../../database/abstract.schema';

export enum RelationshipStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  BLOCKED = 'blocked',
}

@Schema({ collection: 'relationships', timestamps: true })
export class Relationship extends AbstractDocument {
  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  user1Id: Types.ObjectId; // userId nhỏ hơn

  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  user2Id: Types.ObjectId; // userId lớn hơn

  @Prop({
    required: true,
    enum: RelationshipStatus,
    default: RelationshipStatus.PENDING,
  })
  status: RelationshipStatus;

  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  initiator: Types.ObjectId; // ai gửi lời mời
}

export const RelationshipSchema = SchemaFactory.createForClass(Relationship);

// Create compound indexes for optimal query performance
RelationshipSchema.index({ user1Id: 1, status: 1 });
RelationshipSchema.index({ user2Id: 1, status: 1 });
RelationshipSchema.index({ user1Id: 1, user2Id: 1 }, { unique: true });
