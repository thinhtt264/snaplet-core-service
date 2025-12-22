import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { AbstractDocument } from '../../../database/abstract.schema';

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

// Virtual field for displayName (computed from firstName + lastName)
UserSchema.virtual('displayName').get(function () {
  return `${this.firstName} ${this.lastName}`.trim();
});

// Ensure virtual fields are included in JSON output
UserSchema.set('toJSON', { virtuals: true });
UserSchema.set('toObject', { virtuals: true });

// Create indexes
UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ username: 1 }, { unique: true });
