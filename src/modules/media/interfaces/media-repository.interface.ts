import { Types } from 'mongoose';
import { Media } from '../schemas/media.schema';

export interface IMediaRepository {
  create(media: Partial<Media>): Promise<Media>;
  findById(id: Types.ObjectId): Promise<Media | null>;
  findByIds(ids: Types.ObjectId[]): Promise<Media[]>;
  updateStatusIf(
    id: Types.ObjectId,
    currentStatus: Media['status'],
    newStatus: Media['status'],
    updates?: Partial<Media>,
  ): Promise<Media | null>;
  updateStatusIfWithOwner(
    id: Types.ObjectId,
    ownerId: Types.ObjectId,
    currentStatus: Media['status'],
    newStatus: Media['status'],
    updates?: Partial<Media>,
  ): Promise<Media | null>;
  findByOwnerId(ownerId: Types.ObjectId): Promise<Media[]>;
  countDocuments(filter: any): Promise<number>;
  findOrphanedMedia(olderThanHours: number): Promise<Media[]>;
  deleteMany(ids: Types.ObjectId[]): Promise<number>; // Soft delete (set isDeleted: true)
  hardDeleteManyIfStatus(
    ids: Types.ObjectId[],
    allowedStatuses?: string[],
  ): Promise<number>;
}
