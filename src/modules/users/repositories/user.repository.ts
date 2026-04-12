import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User } from '../schemas/user.schema';
import { IUserRepository } from '../interfaces/user-repository.interface';
import {
  RawSearchUser,
  SearchUserBasicInfoWithRelationshipStatusRaw,
} from '../interfaces/search-users.interface';
import {
  Relationship,
  RelationshipStatus,
} from '@modules/relationships/schemas/relationship.schema';

@Injectable()
export class UserRepository implements IUserRepository {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Relationship.name)
    private readonly relationshipModel: Model<Relationship>,
  ) {}

  async findActiveByEmail(email: string): Promise<User | null> {
    return this.userModel
      .findOne({ email: email.toLowerCase().trim(), isDeleted: false })
      .exec();
  }

  async findActiveByUsername(username: string): Promise<User | null> {
    return this.userModel
      .findOne({
        username: username.toLowerCase().trim(),
        isDeleted: false,
      })
      .exec();
  }

  async findActiveById(id: string): Promise<User | null> {
    return this.userModel.findOne({ _id: id, isDeleted: false }).exec();
  }

  async findByGoogleId(googleId: string): Promise<User | null> {
    return this.userModel
      .findOne({ googleId: googleId.trim(), isDeleted: false })
      .exec();
  }

  async linkGoogleId(userId: string, googleId: string): Promise<User> {
    const updated = await this.userModel
      .findOneAndUpdate(
        { _id: userId, isDeleted: false },
        { $set: { googleId: googleId.trim() } },
        { new: true },
      )
      .exec();

    if (!updated) {
      // Keep repository contract: if user doesn't exist, callers treat as error.
      throw new Error('User not found');
    }

    return updated;
  }

  async checkEmailExists(email: string): Promise<boolean> {
    const user = await this.userModel
      .findOne({ email: email.toLowerCase().trim() })
      .exec();
    return !!user;
  }

  async checkUsernameExists(username: string): Promise<boolean> {
    const user = await this.userModel
      .findOne({ username: username.toLowerCase().trim() })
      .exec();
    return !!user;
  }

  async create(userData: Partial<User>): Promise<User> {
    const user = new this.userModel({
      ...userData,
      email: userData.email?.toLowerCase().trim(),
      username: userData.username?.toLowerCase().trim(),
    });
    return user.save();
  }

  async update(userId: string, update: Partial<User>): Promise<User | null> {
    const normalized: Partial<User> = { ...update };
    if (normalized.email) {
      normalized.email = normalized.email.toLowerCase().trim();
    }
    if (normalized.username) {
      normalized.username = normalized.username.toLowerCase().trim();
    }

    return this.userModel
      .findOneAndUpdate(
        { _id: userId, isDeleted: false },
        { $set: normalized },
        { new: true },
      )
      .exec();
  }

  private async searchByUsernameRaw(
    normalizedQuery: string,
    limit: number,
  ): Promise<RawSearchUser[]> {
    return this.userModel
      .aggregate<RawSearchUser>([
        {
          $match: {
            isDeleted: false,
            // username is stored lowercase -> no need for $options: 'i'
            username: { $regex: `^${normalizedQuery}` },
          },
        },
        {
          $addFields: {
            _matchDistance: {
              $subtract: [{ $strLenCP: '$username' }, normalizedQuery.length],
            },
          },
        },
        {
          $sort: {
            _matchDistance: 1,
            username: 1,
          },
        },
        { $limit: limit },
        {
          $project: {
            _id: 1,
            username: 1,
            firstName: 1,
            lastName: 1,
            avatarKey: 1,
          },
        },
      ])
      .exec();
  }

  async updateAvatarKey(
    userId: string,
    avatarKey: string,
  ): Promise<User | null> {
    return this.userModel
      .findOneAndUpdate(
        { _id: userId, isDeleted: false },
        { avatarKey },
        { new: true },
      )
      .exec();
  }

  async updateName(
    userId: string,
    firstName: string,
    lastName: string,
  ): Promise<User | null> {
    return this.userModel
      .findOneAndUpdate(
        { _id: userId, isDeleted: false },
        {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
        },
        { new: true },
      )
      .exec();
  }

  async searchByUsernameWithRelationship(
    requesterId: string,
    query: string,
    limit: number,
  ): Promise<SearchUserBasicInfoWithRelationshipStatusRaw[]> {
    const normalizedQuery = query.toLowerCase();
    const rawUsers = await this.searchByUsernameRaw(normalizedQuery, limit);

    const targetUsers = rawUsers.filter(
      (u) => u._id.toString() !== requesterId,
    );
    if (!targetUsers.length) return [];

    const targetUserIds = targetUsers.map((u) => u._id.toString());

    const requesterObjectId = new Types.ObjectId(requesterId);
    const targetObjectIds = targetUserIds.map((id) => new Types.ObjectId(id));

    const relationshipRows = await this.relationshipModel
      .aggregate<{
        targetId: string;
        id: string;
        status: RelationshipStatus;
        createdAt: Date;
        initiator: string;
      }>([
        {
          $match: {
            $or: [
              {
                user1Id: requesterObjectId,
                user2Id: { $in: targetObjectIds },
              },
              {
                user2Id: requesterObjectId,
                user1Id: { $in: targetObjectIds },
              },
            ],
          },
        },
        {
          $project: {
            _id: 0,
            targetId: {
              $cond: [
                { $eq: ['$user1Id', requesterObjectId] },
                '$user2Id',
                '$user1Id',
              ],
            },
            id: { $toString: '$_id' },
            status: 1,
            createdAt: 1,
            initiator: 1,
          },
        },
        {
          $project: {
            targetId: { $toString: '$targetId' },
            id: 1,
            status: 1,
            createdAt: 1,
            initiator: { $toString: '$initiator' },
          },
        },
      ])
      .exec();

    const relationshipMap = relationshipRows.reduce(
      (acc, row) => {
        acc[row.targetId] = {
          id: row.id,
          status: row.status,
          createdAt: row.createdAt,
          initiator: row.initiator,
        };
        return acc;
      },
      {} as Record<
        string,
        {
          id: string;
          status: RelationshipStatus;
          createdAt: Date;
          initiator: string;
        }
      >,
    );

    return targetUsers.map((u) => ({
      userId: u._id.toString(),
      username: u.username,
      firstName: u.firstName,
      lastName: u.lastName,
      avatarKey: u.avatarKey,
      ...(relationshipMap[u._id.toString()] ?? {
        id: null,
        status: null,
        createdAt: null,
        initiator: null,
      }),
    }));
  }

  async updateFcmToken(userId: string, fcmToken: string | null): Promise<void> {
    await this.userModel.updateOne(
      { _id: userId, isDeleted: false },
      { $set: { fcmToken } },
    );
  }

  async findFcmToken(userId: string): Promise<string | null> {
    const user = await this.userModel
      .findOne({ _id: userId, isDeleted: false })
      .select('fcmToken')
      .lean()
      .exec();
    const token = (user as { fcmToken?: string | null } | null)?.fcmToken;
    return token ?? null;
  }

  /**
   * Push notification display: first name only (no username fallback).
   */
  async findReactionNotificationLabel(userId: string): Promise<string | null> {
    const doc = await this.userModel
      .findOne({ _id: userId, isDeleted: false })
      .select('firstName')
      .lean()
      .exec();
    if (!doc) return null;
    const row = doc as { firstName?: string };
    const first = row.firstName?.trim();
    return first || null;
  }
}
