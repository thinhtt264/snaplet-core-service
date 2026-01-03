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
}
