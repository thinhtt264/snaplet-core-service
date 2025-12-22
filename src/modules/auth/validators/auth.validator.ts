import { UnauthorizedException } from '@nestjs/common';
import { RefreshTokenRepository } from '../repositories/refresh-token.repository';
import { RefreshToken } from '../schemas/refresh-token.schema';

/**
 * Validate refresh token và trả về token document nếu hợp lệ
 */
export async function validateRefreshToken(
  refreshToken: string,
  refreshTokenRepository: RefreshTokenRepository,
): Promise<RefreshToken> {
  const validToken =
    await refreshTokenRepository.findAndVerifyToken(refreshToken);

  if (!validToken) {
    throw new UnauthorizedException('Invalid or expired refresh token');
  }

  return validToken;
}

/**
 * Validate refresh token và deviceId có khớp không
 * Note: deviceId đã được validate ở controller level qua @DeviceId() decorator
 */
export async function validateRefreshTokenAndDevice(
  refreshToken: string,
  deviceId: string,
  refreshTokenRepository: RefreshTokenRepository,
): Promise<RefreshToken> {
  // Validate refresh token
  const validToken = await validateRefreshToken(
    refreshToken,
    refreshTokenRepository,
  );

  // Kiểm tra deviceId có khớp không
  if (validToken.deviceId !== deviceId) {
    throw new UnauthorizedException('Device ID mismatch');
  }

  return validToken;
}
