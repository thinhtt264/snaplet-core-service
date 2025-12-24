import { Types } from 'mongoose';
import * as bcrypt from 'bcrypt';

/**
 * Sắp xếp 2 userId để đảm bảo user1Id < user2Id
 * @param userId1 - User ID thứ nhất
 * @param userId2 - User ID thứ hai
 * @returns Object chứa user1Id (nhỏ hơn) và user2Id (lớn hơn)
 */
export function sortUserIds(
  userId1: Types.ObjectId | string,
  userId2: Types.ObjectId | string,
): { user1Id: Types.ObjectId; user2Id: Types.ObjectId } {
  // Convert to ObjectId nếu là string
  const id1 =
    userId1 instanceof Types.ObjectId ? userId1 : new Types.ObjectId(userId1);
  const id2 =
    userId2 instanceof Types.ObjectId ? userId2 : new Types.ObjectId(userId2);

  // So sánh ObjectId bằng cách so sánh string representation
  // ObjectId có thể so sánh trực tiếp vì chúng có thứ tự
  if (id1.toString() < id2.toString()) {
    return { user1Id: id1, user2Id: id2 };
  } else {
    return { user1Id: id2, user2Id: id1 };
  }
}

/**
 * Verify password
 * @param plainPassword - Plain password
 * @param hashedPassword - Hashed password
 * @returns True if password is valid, false otherwise
 */
export function verifyPassword(
  plainPassword: string,
  hashedPassword: string,
): Promise<boolean> {
  return bcrypt.compare(plainPassword, hashedPassword);
}
