import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { AbstractDocument } from '../../../database/abstract.schema';
import { Types } from 'mongoose';

@Schema({ collection: 'refresh_tokens', timestamps: true })
export class RefreshToken extends AbstractDocument {
  @Prop({ required: true, type: Types.ObjectId, ref: 'User', index: true })
  userId: Types.ObjectId;

  @Prop({ required: true, index: true })
  deviceId: string;

  @Prop({ required: true, unique: true, index: true })
  hashedToken: string;

  @Prop({ required: true })
  expiresAt: Date;
}

export const RefreshTokenSchema = SchemaFactory.createForClass(RefreshToken);

// Create indexes
RefreshTokenSchema.index({ userId: 1, deviceId: 1 }, { unique: true }); // 1 token per device per user
RefreshTokenSchema.index({ hashedToken: 1 }, { unique: true });
RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
