import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../schemas/user.schema';
import { IUserRepository } from '../interfaces/user-repository.interface';

@Injectable()
export class UserRepository implements IUserRepository {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
  ) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.userModel
      .findOne({ email: email.toLowerCase().trim(), isDeleted: { $ne: true } })
      .exec();
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.userModel
      .findOne({
        username: username.toLowerCase().trim(),
        isDeleted: { $ne: true },
      })
      .exec();
  }

  async findById(id: string): Promise<User | null> {
    return this.userModel.findOne({ _id: id, isDeleted: { $ne: true } }).exec();
  }

  async create(userData: Partial<User>): Promise<User> {
    const user = new this.userModel({
      ...userData,
      email: userData.email?.toLowerCase().trim(),
      username: userData.username?.toLowerCase().trim(),
    });
    return user.save();
  }
}
