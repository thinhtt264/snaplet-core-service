import { Injectable } from '@nestjs/common';
import { UserRepository } from '../repositories/user.repository';
import { User } from '../schemas/user.schema';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UserService {
  constructor(private readonly userRepository: UserRepository) {}

  /**
   * Tìm user theo email
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findByEmail(email);
  }

  /**
   * Tìm user theo username
   */
  async findByUsername(username: string): Promise<User | null> {
    return this.userRepository.findByUsername(username);
  }

  /**
   * Tìm user theo ID
   */
  async findById(id: string): Promise<User | null> {
    return this.userRepository.findById(id);
  }

  /**
   * Hash password
   */
  async hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    return bcrypt.hash(password, saltRounds);
  }

  /**
   * Tạo user mới với password đã được hash
   * Lưu ý: Validation (email/username unique) phải được thực hiện trước khi gọi method này
   */
  async createUser(userData: {
    email: string;
    username: string;
    firstName: string;
    lastName: string;
    password: string;
  }): Promise<User> {
    // Hash password
    const hashedPassword = await this.hashPassword(userData.password);

    // Tạo user mới
    return this.userRepository.create({
      email: userData.email,
      username: userData.username,
      firstName: userData.firstName,
      lastName: userData.lastName,
      password: hashedPassword,
    });
  }

  /**
   * Verify password
   */
  async verifyPassword(
    plainPassword: string,
    hashedPassword: string,
  ): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  /**
   * Validate user credentials
   */
  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.findByEmail(email);
    if (!user) {
      return null;
    }

    const isPasswordValid = await this.verifyPassword(password, user.password);
    if (!isPasswordValid) {
      return null;
    }

    return user;
  }
}
