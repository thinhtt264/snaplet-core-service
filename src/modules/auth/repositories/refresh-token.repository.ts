import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { RefreshToken } from '../schemas/refresh-token.schema';

@Injectable()
export class RefreshTokenRepository {
  constructor(
    @InjectModel(RefreshToken.name)
    private readonly refreshTokenModel: Model<RefreshToken>,
  ) {}

  async create(
    userId: string,
    deviceId: string,
    hashedToken: string,
    expiresAt: Date,
  ): Promise<RefreshToken> {
    // Tối ưu: Query với userId + deviceId (tận dụng compound unique index)
    // Upsert: nếu đã có token cho device này thì update, không thì tạo mới
    const result = await this.refreshTokenModel
      .findOneAndUpdate(
        {
          userId: new Types.ObjectId(userId),
          deviceId,
        },
        {
          $set: {
            userId: new Types.ObjectId(userId),
            deviceId,
            hashedToken,
            expiresAt,
          },
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        },
      )
      .exec();

    return result as RefreshToken;
  }

  async findByUserIdAndDevice(
    userId: string,
    deviceId: string,
  ): Promise<RefreshToken | null> {
    // Tối ưu: Query với userId + deviceId (tận dụng compound unique index)
    // Filter expiresAt được apply sau khi dùng index
    return this.refreshTokenModel
      .findOne({
        userId: new Types.ObjectId(userId),
        deviceId,
        expiresAt: { $gt: new Date() },
      })
      .populate('userId')
      .exec();
  }

  async deleteByUserIdAndDevice(
    userId: string,
    deviceId: string,
  ): Promise<void> {
    // Hard delete: Xóa hẳn token (không cần soft delete)
    // Tối ưu: Query với userId + deviceId (tận dụng compound unique index)
    await this.refreshTokenModel
      .deleteOne({
        userId: new Types.ObjectId(userId),
        deviceId,
      })
      .exec();
  }

  async deleteByUserId(userId: string): Promise<void> {
    // Hard delete: Xóa hẳn tất cả tokens của user (logout all devices)
    // Tối ưu: Query với userId (tận dụng index { userId: 1 })
    await this.refreshTokenModel
      .deleteMany({
        userId: new Types.ObjectId(userId),
      })
      .exec();
  }
}
