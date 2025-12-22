import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { RefreshToken } from '../schemas/refresh-token.schema';
import * as bcrypt from 'bcrypt';

@Injectable()
export class RefreshTokenRepository {
  constructor(
    @InjectModel(RefreshToken.name)
    private readonly refreshTokenModel: Model<RefreshToken>,
  ) {}

  /**
   * Hash token trước khi lưu
   */
  async hashToken(token: string): Promise<string> {
    const saltRounds = 10;
    return bcrypt.hash(token, saltRounds);
  }

  /**
   * Verify token với hashed token
   */
  async verifyToken(token: string, hashedToken: string): Promise<boolean> {
    return bcrypt.compare(token, hashedToken);
  }

  /**
   * Tạo refresh token mới (xóa token cũ của device trước)
   */
  async create(
    userId: string,
    deviceId: string,
    hashedToken: string,
    expiresAt: Date,
  ): Promise<RefreshToken> {
    // Xóa token cũ của device này (1 token per device)
    await this.deleteByUserIdAndDevice(userId, deviceId);

    const refreshToken = new this.refreshTokenModel({
      userId: new Types.ObjectId(userId),
      deviceId,
      hashedToken,
      expiresAt,
    });
    return refreshToken.save();
  }

  /**
   * Tìm và verify refresh token
   * Trả về token document nếu token hợp lệ
   */
  async findAndVerifyToken(token: string): Promise<RefreshToken | null> {
    // Lấy tất cả tokens chưa bị xóa và chưa hết hạn
    const tokens = await this.refreshTokenModel
      .find({
        isDeleted: { $ne: true },
        expiresAt: { $gt: new Date() },
      })
      .populate('userId')
      .exec();

    // Verify từng token
    for (const tokenDoc of tokens) {
      const isValid = await this.verifyToken(token, tokenDoc.hashedToken);
      if (isValid) {
        return tokenDoc;
      }
    }

    return null;
  }

  /**
   * Tìm refresh token theo hashed token
   */
  async findByHashedToken(hashedToken: string): Promise<RefreshToken | null> {
    return this.refreshTokenModel
      .findOne({ hashedToken, isDeleted: { $ne: true } })
      .populate('userId')
      .exec();
  }

  /**
   * Tìm refresh token theo userId và deviceId
   */
  async findByUserIdAndDevice(
    userId: string,
    deviceId: string,
  ): Promise<RefreshToken | null> {
    return this.refreshTokenModel
      .findOne({
        userId: new Types.ObjectId(userId),
        deviceId,
        isDeleted: { $ne: true },
      })
      .exec();
  }

  /**
   * Xóa token theo hashed token
   */
  async deleteByHashedToken(hashedToken: string): Promise<void> {
    await this.refreshTokenModel
      .updateOne({ hashedToken }, { isDeleted: true })
      .exec();
  }

  /**
   * Xóa token theo userId và deviceId
   */
  async deleteByUserIdAndDevice(
    userId: string,
    deviceId: string,
  ): Promise<void> {
    await this.refreshTokenModel
      .updateMany(
        { userId: new Types.ObjectId(userId), deviceId },
        { isDeleted: true },
      )
      .exec();
  }

  /**
   * Xóa tất cả token của user
   */
  async deleteByUserId(userId: string): Promise<void> {
    await this.refreshTokenModel
      .updateMany({ userId: new Types.ObjectId(userId) }, { isDeleted: true })
      .exec();
  }
}
