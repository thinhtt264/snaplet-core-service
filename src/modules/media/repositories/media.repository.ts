import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Media } from '../schemas/media.schema';
import { IMediaRepository } from '../interfaces/media-repository.interface';

@Injectable()
export class MediaRepository implements IMediaRepository {
  constructor(
    @InjectModel(Media.name) private readonly mediaModel: Model<Media>,
  ) {}

  async create(media: Partial<Media>): Promise<Media> {
    const createdMedia = new this.mediaModel(media);
    return createdMedia.save();
  }

  async findById(id: Types.ObjectId): Promise<Media | null> {
    return this.mediaModel.findById(id).exec();
  }

  async findByIds(ids: Types.ObjectId[]): Promise<Media[]> {
    return this.mediaModel
      .find({
        _id: { $in: ids },
        isDeleted: { $ne: true },
      })
      .exec();
  }

  /**
   * Atomic update: Update status only if current status matches expected value
   * Prevents race condition by ensuring status transition is atomic
   */
  async updateStatusIf(
    id: Types.ObjectId,
    currentStatus: Media['status'],
    newStatus: Media['status'],
    updates?: Partial<Media>,
  ): Promise<Media | null> {
    return this.mediaModel
      .findOneAndUpdate(
        {
          _id: id,
          status: currentStatus, // Atomic condition: only update if status matches
          isDeleted: { $ne: true },
        },
        {
          $set: {
            status: newStatus,
            ...updates,
          },
        },
        { new: true },
      )
      .exec();
  }

  /**
   * Atomic update with owner check: Update status only if current status matches
   * and ownerId matches. Prevents race condition and unauthorized access.
   */
  async updateStatusIfWithOwner(
    id: Types.ObjectId,
    ownerId: Types.ObjectId,
    currentStatus: Media['status'],
    newStatus: Media['status'],
    updates?: Partial<Media>,
  ): Promise<Media | null> {
    return this.mediaModel
      .findOneAndUpdate(
        {
          _id: id,
          ownerId: ownerId, // Atomic owner check
          status: currentStatus, // Atomic condition: only update if status matches
          isDeleted: { $ne: true },
        },
        {
          $set: {
            status: newStatus,
            ...updates,
          },
        },
        { new: true },
      )
      .exec();
  }

  async findByOwnerId(ownerId: Types.ObjectId): Promise<Media[]> {
    return this.mediaModel
      .find({
        ownerId,
        isDeleted: { $ne: true },
      })
      .sort({ createdAt: -1 })
      .exec();
  }

  async countDocuments(filter: any): Promise<number> {
    return this.mediaModel.countDocuments(filter).exec();
  }

  /**
   * Find orphaned media (not used in any posts, older than X hours)
   * Orphaned media = media that is READY or PENDING but not referenced in any post
   */
  async findOrphanedMedia(olderThanHours: number): Promise<Media[]> {
    const olderThanDate = new Date(
      Date.now() - olderThanHours * 60 * 60 * 1000,
    );

    // Find all media IDs that are used in posts
    // mediaIds is an array field, so we need to unwind and get distinct values
    const usedMediaIdsResult = await this.mediaModel.db
      .collection('posts')
      .aggregate([
        {
          $match: {
            isDeleted: { $ne: true },
          },
        },
        {
          $unwind: '$mediaIds',
        },
        {
          $group: {
            _id: null,
            mediaIds: { $addToSet: '$mediaIds' },
          },
        },
      ])
      .toArray();

    const usedMediaIds =
      usedMediaIdsResult.length > 0
        ? usedMediaIdsResult[0].mediaIds.map((id: any) =>
            id instanceof Types.ObjectId ? id : new Types.ObjectId(id),
          )
        : [];

    // Find media that:
    // 1. Is not deleted
    // 2. Is READY or PENDING status
    // 3. Is not in usedMediaIds
    // 4. Created before olderThanDate
    return this.mediaModel
      .find({
        _id: { $nin: usedMediaIds },
        isDeleted: { $ne: true },
        status: { $in: ['READY', 'PENDING'] },
        createdAt: { $lt: olderThanDate },
      })
      .exec();
  }

  /**
   * Soft delete multiple media by IDs (set isDeleted: true)
   * Use this when user deletes a post - keep media for potential recovery
   */
  async deleteMany(ids: Types.ObjectId[]): Promise<number> {
    const result = await this.mediaModel
      .updateMany({ _id: { $in: ids } }, { $set: { isDeleted: true } })
      .exec();
    return result.modifiedCount;
  }

  /**
   * Hard delete multiple media by IDs (remove from DB completely)
   * Use this for orphaned media that has no post references
   */
  async hardDeleteMany(ids: Types.ObjectId[]): Promise<number> {
    const result = await this.mediaModel
      .deleteMany({ _id: { $in: ids } })
      .exec();
    return result.deletedCount;
  }
}
