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
  })
  username: string;

  @Prop({ required: true, trim: true })
  firstName: string;

  @Prop({ required: true, trim: true })
  lastName: string;

  @Prop({ default: '' })
  avatarUrl: string;

  @Prop({ default: '' })
  deviceToken: string;
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
