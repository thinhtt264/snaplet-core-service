import { AbstractDocument } from '@database/abstract.schema';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

@Schema({ collection: 'refresh_tokens', timestamps: true })
export class RefreshToken extends AbstractDocument {
  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  userId: Types.ObjectId;

  @Prop({ required: true })
  deviceId: string;

  @Prop({ required: true, unique: true, index: true })
  hashedToken: string;

  @Prop({ required: true })
  expiresAt: Date;
}

export const RefreshTokenSchema = SchemaFactory.createForClass(RefreshToken);

// Optimized indexes - Hard delete approach (không dùng soft delete)
// 1. Compound unique index: 1 token per device per user
//    Tối ưu cho: findByUserIdAndDevice, create (upsert), deleteByUserIdAndDevice
RefreshTokenSchema.index(
  { userId: 1, deviceId: 1 },
  { unique: true, name: 'userId_deviceId_unique' },
);

// 2. Index cho query deleteByUserId (chỉ có userId, không có deviceId)
//    Compound index có thể dùng left-prefix nhưng index riêng sẽ tối ưu hơn
RefreshTokenSchema.index({ userId: 1 }, { name: 'userId' });

// 3. TTL index để tự động xóa expired tokens
RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
