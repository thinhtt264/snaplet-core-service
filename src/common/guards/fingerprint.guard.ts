import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpStatus,
} from '@nestjs/common';
import { AppException } from '@common/exception/AppException';
import { ErrorCode } from '@common/constants';
import { extractFingerprint } from '@common/utils/fingerprint.utils';
import { BaseRequest } from '@common/types/request.types';

@Injectable()
export class FingerprintGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<BaseRequest>();

    // Skip fingerprint validation for health check routes
    const url = req.url || req.path;
    if (url.startsWith('/health') || url.includes('/health')) {
      return true;
    }

    const header = req.headers['x-client-fingerprint'] as string | undefined;

    if (!header) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.INVALID_FINGERPRINT,
        'Missing fingerprint',
      );
    }

    try {
      req.fingerprint = extractFingerprint(header);
    } catch {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.INVALID_FINGERPRINT,
        'Invalid fingerprint format',
      );
    }

    return true;
  }
}
