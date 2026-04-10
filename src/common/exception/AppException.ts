import { ErrorCode } from '@common/constants';
import { HttpException, HttpStatus } from '@nestjs/common';

export interface AppExceptionResponse {
  error: {
    code: ErrorCode;
    message: string;
    meta?: any;
  };
}

export class AppException extends HttpException {
  private readonly errorCode: ErrorCode;
  private readonly errorMessage: string;
  private readonly errorMeta?: any;

  constructor(
    status: HttpStatus,
    code: ErrorCode,
    message: string,
    meta?: any,
  ) {
    const response: AppExceptionResponse = {
      error: {
        code,
        message,
        ...(meta !== undefined ? { meta } : undefined),
      },
    };

    super(response, status);

    this.errorCode = code;
    this.errorMessage = message;
    this.errorMeta = meta;
  }

  getErrorCode(): ErrorCode {
    return this.errorCode;
  }

  getErrorMessage(): string {
    return this.errorMessage;
  }

  getErrorMeta(): any {
    return this.errorMeta;
  }

  static isAppException(exception: unknown): exception is AppException {
    return exception instanceof AppException;
  }
}
