import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { AbstractDocument } from '../../../database/abstract.schema';
import {
  ALLOWED_IMAGE_MIME_TYPES,
  type ImageMimeType,
} from '@common/types/mime-type.types';
import { ImageTransform } from '@common/types';

export enum MediaStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  READY = 'READY',
  FAILED = 'FAILED',
}

@Schema({ collection: 'media', timestamps: true })
export class Media extends AbstractDocument {
  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  ownerId: Types.ObjectId;

  @Prop({ required: true, enum: ALLOWED_IMAGE_MIME_TYPES })
  mimeType: ImageMimeType;

  @Prop()
  mediaKey?: string;

  @Prop()
  duration?: number; // video

  @Prop({ required: true, type: Object })
  transform: ImageTransform;

  @Prop({ required: true, enum: MediaStatus, default: MediaStatus.PENDING })
  status: MediaStatus;
}

export const MediaSchema = SchemaFactory.createForClass(Media);

MediaSchema.index(
  { ownerId: 1, createdAt: -1 },
  {
    partialFilterExpression: { isDeleted: { $ne: true } },
    name: 'idx_ownerId_createdAt_active',
  },
);

MediaSchema.index(
  { status: 1 },
  {
    partialFilterExpression: { isDeleted: { $ne: true } },
    name: 'idx_status_active',
  },
);

// Index for assertMediaReadyAndOwned query
// Optimizes: { _id: { $in: [...] }, ownerId: ..., status: ..., isDeleted: { $ne: true } }
MediaSchema.index(
  { _id: 1, ownerId: 1, status: 1, isDeleted: 1 },
  {
    name: 'idx_id_ownerId_status_isDeleted',
  },
);

// Index for findOrphanedMedia query
// Optimizes: { status: { $in: ['READY', 'PENDING'] }, createdAt: { $lt: ... }, isDeleted: { $ne: true } }
MediaSchema.index(
  { status: 1, createdAt: 1 },
  {
    partialFilterExpression: { isDeleted: { $ne: true } },
    name: 'idx_status_createdAt_active',
  },
);
