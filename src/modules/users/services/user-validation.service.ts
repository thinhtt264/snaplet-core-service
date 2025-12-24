import { Injectable, ConflictException } from '@nestjs/common';
import { UserRepository } from '../repositories/user.repository';
import { validateEmailFormat, verifyPassword } from '@common/utils';
import { User } from '../schemas/user.schema';

@Injectable()
export class UserValidationService {
  constructor(private readonly userRepository: UserRepository) {}

  /**
   * Validate email không trùng lặp
   */
  async validateEmailUnique(email: string): Promise<void> {
    validateEmailFormat(email);

    const existingUser = await this.userRepository.findByEmail(email);
    if (existingUser) {
      throw new ConflictException('Email already exists');
    }
  }

  /**
   * Validate username không trùng lặp
   */
  async validateUsernameUnique(username: string): Promise<void> {
    const existingUser = await this.userRepository.findByUsername(username);
    if (existingUser) {
      throw new ConflictException('Username already exists');
    }
  }

  /**
   * Validate cả email và username không trùng lặp
   */
  async validateUserUnique(email: string, username: string): Promise<void> {
    await Promise.all([
      this.validateEmailUnique(email),
      this.validateUsernameUnique(username),
    ]);
  }

  /**
   * Check email có available không (chưa được sử dụng)
   * Return boolean thay vì throw exception
   */
  async checkEmailAvailable(email: string): Promise<{ available: boolean }> {
    try {
      await this.validateEmailUnique(email);
      return { available: true };
    } catch {
      return { available: false };
    }
  }

  /**
   * Check username có available không (chưa được sử dụng)
   * Return boolean thay vì throw exception
   */
  async checkUsernameAvailable(
    username: string,
  ): Promise<{ available: boolean }> {
    try {
      await this.validateUsernameUnique(username);
      return { available: true };
    } catch {
      return { available: false };
    }
  }

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      return null;
    }

    const isPasswordValid = await verifyPassword(password, user.password);
    if (!isPasswordValid) {
      return null;
    }

    return user;
  }
}
