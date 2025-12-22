/**
 * Utility functions for date operations
 */

/**
 * Tính toán expiration date từ string (ví dụ: '30d', '7d', '720h', '5m', '30s')
 * @param expiresIn - String format: số + unit (s=seconds, m=minutes, h=hours, d=days)
 * @param defaultDays - Số ngày mặc định nếu format không hợp lệ (default: 30)
 * @returns Date object với expiration time
 */
export function calculateExpirationDate(
  expiresIn: string,
  defaultDays: number = 30,
): Date {
  const expiresAt = new Date();
  const match = expiresIn.match(/^(\d+)([smhd])$/i);

  if (!match) {
    // Default to specified days if format is invalid
    expiresAt.setDate(expiresAt.getDate() + defaultDays);
    return expiresAt;
  }

  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();

  switch (unit) {
    case 's': // seconds
      expiresAt.setSeconds(expiresAt.getSeconds() + value);
      break;
    case 'm': // minutes
      expiresAt.setMinutes(expiresAt.getMinutes() + value);
      break;
    case 'h': // hours
      expiresAt.setHours(expiresAt.getHours() + value);
      break;
    case 'd': // days
      expiresAt.setDate(expiresAt.getDate() + value);
      break;
    default:
      expiresAt.setDate(expiresAt.getDate() + defaultDays);
  }

  return expiresAt;
}
