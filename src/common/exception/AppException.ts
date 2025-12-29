import { ErrorCode } from '@common/constants';
import { HttpException, HttpStatus } from '@nestjs/common';

export class AppException extends HttpException {
  constructor(
    status: HttpStatus,
    code: ErrorCode,
    message: string,
    meta?: any,
  ) {
    super(
      {
        error: {
          code,
          message,
          ...(meta !== undefined ? { meta } : undefined),
        },
      },
      status,
    );
  }
}
