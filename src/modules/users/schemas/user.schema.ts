import { USER_PROFILE_FIELD_MAX_LENGTH } from '@common/constants';
import { AbstractDocument } from '@database/abstract.schema';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ collection: 'users', timestamps: true })
export class User extends AbstractDocument {
  @Prop({
    required: true,
    unique: true,
    index: true,
    lowercase: true,
    trim: true,
  })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop({
    required: true,
    unique: true,
    index: true,
    lowercase: true,
    trim: true,
    maxlength: USER_PROFILE_FIELD_MAX_LENGTH,
  })
  username: string;

  @Prop({
    required: true,
    trim: true,
    maxlength: USER_PROFILE_FIELD_MAX_LENGTH,
  })
  firstName: string;

  @Prop({
    required: true,
    trim: true,
    maxlength: USER_PROFILE_FIELD_MAX_LENGTH,
  })
  lastName: string;

  @Prop({ default: '' })
  avatarKey: string;

  @Prop({ default: '' })
  deviceToken: string;

  /** Single-device FCM registration token; new login overwrites previous. */
  @Prop({ type: String, default: null })
  fcmToken: string | null;
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.index(
  { email: 1 },
  {
    partialFilterExpression: { isDeleted: false },
    name: 'idx_email_active',
  },
);

UserSchema.index(
  { username: 1 },
  {
    partialFilterExpression: { isDeleted: false },
    name: 'idx_username_active',
  },
);
