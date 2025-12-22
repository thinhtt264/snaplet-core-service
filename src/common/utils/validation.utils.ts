import { BadRequestException } from '@nestjs/common';

/**
 * Regex pattern để validate email format
 * Pattern này kiểm tra:
 * - Có ký tự trước @
 * - Có domain hợp lệ sau @
 * - Có TLD (top-level domain) ít nhất 2 ký tự
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Validate email format
 * @param email - Email cần validate
 * @throws BadRequestException nếu email format không hợp lệ
 */
export function validateEmailFormat(email: string): void {
  if (!email) {
    throw new BadRequestException('Email is required');
  }

  if (typeof email !== 'string') {
    throw new BadRequestException('Email must be a string');
  }

  // Trim và normalize email
  const normalizedEmail = email.trim().toLowerCase();

  if (!EMAIL_REGEX.test(normalizedEmail)) {
    throw new BadRequestException('Invalid email format');
  }
}
