import { AbstractDocument } from '@database/abstract.schema';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

export type TrustLevel = 'unknown' | 'trusted' | 'flagged';
export type Platform = 'ios' | 'android';

@Schema({ collection: 'user_fingerprints', timestamps: false })
export class UserFingerprint extends AbstractDocument {
  @Prop({ type: Types.ObjectId, ref: 'User', default: null, index: true })
  userId?: Types.ObjectId | null; // nullable – có thể chưa login

  @Prop({ type: String, default: null, index: true })
  deviceId?: string | null; // từ client (best-effort)

  // Network
  @Prop({ required: true, type: String })
  ip: string;

  @Prop({ required: true, type: String })
  userAgent: string;

  // Device info (best-effort)
  @Prop({ type: String, enum: ['ios', 'android'] })
  platform?: Platform;

  @Prop({ type: String })
  appVersion?: string;

  @Prop({ type: String })
  deviceModel?: string;

  // Server side
  @Prop({ type: Date, required: true, default: Date.now })
  firstSeenAt: Date;

  @Prop({ type: Date, required: true, default: Date.now })
  lastSeenAt: Date;

  // Meta
  @Prop({ type: Number, default: 0 })
  requestCount: number; // optional, rất hữu ích

  @Prop({
    type: String,
    enum: ['unknown', 'trusted', 'flagged'],
    default: 'unknown',
  })
  trustLevel: TrustLevel;
}

export const UserFingerprintSchema =
  SchemaFactory.createForClass(UserFingerprint);

// Index 1: Tra theo user
// Dùng cho: Thống kê user dùng bao nhiêu device, Phát hiện user bất thường
UserFingerprintSchema.index({ userId: 1 }, { name: 'idx_userId' });

// Index 2: Tra theo device
// Dùng cho: Device đổi user, Abuse detection sau này
UserFingerprintSchema.index({ deviceId: 1 }, { name: 'idx_deviceId' });
