import { HttpStatus } from '@nestjs/common';
import { AppException } from '@common/exception/AppException';
import { ErrorCode } from '@common/constants';
import { ClientFingerprint } from '@common/types/fingerprint.types';

/**
 * Enable/disable timestamp validation for fingerprints
 * Set to false to skip timestamp checks
 */
export const ENABLED_TS_CHECK = false;

/**
 * Extract and validate fingerprint from X-Client-Fingerprint header
 * @param headerValue Base64-encoded JSON string
 * @returns Validated ClientFingerprint object
 * @throws AppException if validation fails
 */
export function extractFingerprint(headerValue: string): ClientFingerprint {
  let decoded: string;
  let fingerprint: ClientFingerprint;

  // Try to decode base64
  try {
    decoded = Buffer.from(headerValue, 'base64').toString('utf-8');
  } catch {
    throw new AppException(
      HttpStatus.BAD_REQUEST,
      ErrorCode.INVALID_FINGERPRINT,
      'Invalid X-Client-Fingerprint',
    );
  }

  // Try to parse JSON
  try {
    fingerprint = JSON.parse(decoded);
  } catch {
    throw new AppException(
      HttpStatus.BAD_REQUEST,
      ErrorCode.INVALID_FINGERPRINT,
      'Invalid X-Client-Fingerprint',
    );
  }

  // Validate required fields
  const requiredFields = ['deviceId', 'platform', 'appVersion'];
  const missingFields = requiredFields.filter((field) => !fingerprint[field]);

  if (missingFields.length > 0) {
    throw new AppException(
      HttpStatus.BAD_REQUEST,
      ErrorCode.INVALID_FINGERPRINT,
      `Invalid fingerprint: missing fields: ${missingFields.join(', ')}`,
      { missingFields },
    );
  }

  // Validate platform value (only 'ios' or 'android' allowed)
  const validPlatforms = ['ios', 'android'];
  if (!validPlatforms.includes(fingerprint.platform)) {
    throw new AppException(
      HttpStatus.BAD_REQUEST,
      ErrorCode.INVALID_FINGERPRINT,
      `Invalid fingerprint: platform must be 'ios' or 'android', got '${fingerprint.platform}'`,
      { platform: fingerprint.platform, validPlatforms },
    );
  }

  // Validate timestamp (ts should not be more than 15 minutes old)
  // Skip validation if ENABLED_TS_CHECK is false
  if (ENABLED_TS_CHECK) {
    if (fingerprint.ts) {
      const now = Math.floor(Date.now() / 1000); // Current time in seconds
      const timestamp = fingerprint.ts;
      const maxAge = 15 * 60; // 15 minutes in seconds

      if (timestamp > now + 60) {
        // Allow 1 minute clock skew for future timestamps
        throw new AppException(
          HttpStatus.BAD_REQUEST,
          ErrorCode.INVALID_FINGERPRINT,
          'Fingerprint timestamp is too far in the future',
        );
      }

      if (now - timestamp > maxAge) {
        throw new AppException(
          HttpStatus.BAD_REQUEST,
          ErrorCode.INVALID_FINGERPRINT,
          'Invalid fingerprint',
          { timestamp, now, maxAge },
        );
      }
    } else {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.INVALID_FINGERPRINT,
        'Invalid fingerprint: missing ts field',
      );
    }
  }

  return fingerprint;
}
