import { Injectable, ConflictException } from '@nestjs/common';
import { UserRepository } from '../repositories/user.repository';
import { verifyPassword } from '@common/utils';
import { User } from '../schemas/user.schema';

@Injectable()
export class UserValidationService {
  constructor(private readonly userRepository: UserRepository) {}

  async validateEmailUnique(email: string): Promise<void> {
    const emailExists = await this.userRepository.checkEmailExists(email);
    if (emailExists) {
      throw new ConflictException('Email already exists');
    }
  }

  async validateUsernameUnique(username: string): Promise<void> {
    const usernameExists =
      await this.userRepository.checkUsernameExists(username);
    if (usernameExists) {
      throw new ConflictException('Username already exists');
    }
  }

  async validateUserUnique(email: string, username: string): Promise<void> {
    await Promise.all([
      this.validateEmailUnique(email),
      this.validateUsernameUnique(username),
    ]);
  }

  async checkEmailAvailable(email: string): Promise<{ available: boolean }> {
    try {
      await this.validateEmailUnique(email);
      return { available: true };
    } catch {
      return { available: false };
    }
  }

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
    const user = await this.userRepository.findActiveByEmail(email);
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
