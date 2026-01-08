import { ErrorCode } from '@common/constants';
import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Interface định nghĩa cấu trúc error response từ AppException
 */
export interface AppExceptionResponse {
  error: {
    code: ErrorCode;
    message: string;
    meta?: any;
  };
}

/**
 * Custom exception class với cấu trúc rõ ràng cho error handling
 * Hỗ trợ errorCode, message và meta data để dễ dàng mở rộng
 */
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

  /**
   * Lấy error code
   */
  getErrorCode(): ErrorCode {
    return this.errorCode;
  }

  /**
   * Lấy error message
   */
  getErrorMessage(): string {
    return this.errorMessage;
  }

  /**
   * Lấy meta data (nếu có)
   */
  getErrorMeta(): any {
    return this.errorMeta;
  }

  /**
   * Kiểm tra xem exception có phải AppException không
   */
  static isAppException(exception: unknown): exception is AppException {
    return exception instanceof AppException;
  }
}
