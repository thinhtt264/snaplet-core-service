import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { AppException } from '@common/exception/AppException';

/**
 * Interface định nghĩa cấu trúc response chuẩn của API
 */
export interface ApiResponse<T = any> {
  status: {
    code: number;
    message: string;
    meta?: {
      errorCode?: string;
      message?: string;
      [key: string]: any;
    };
  };
  data: T | null;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let errorMessage = 'Internal server error';
    let metaData: any = undefined;

    // Xử lý AppException (custom exception với errorCode và meta)
    if (AppException.isAppException(exception)) {
      errorMessage = exception.getErrorMessage();
      metaData = {
        errorCode: exception.getErrorCode(),
        message: exception.getErrorMessage(),
        ...(exception.getErrorMeta() || {}),
      };
    }
    // Xử lý HttpException thông thường (NestJS standard exceptions)
    else if (exception instanceof HttpException) {
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        errorMessage = exceptionResponse;
        metaData = {
          message: exceptionResponse,
        };
      } else {
        // Xử lý object response từ NestJS exceptions
        const responseObj = exceptionResponse as any;
        errorMessage = responseObj?.message || exception.message;

        // Nếu response có structure phức tạp, merge vào meta
        metaData = {
          message: errorMessage,
          ...(responseObj?.error ? { error: responseObj.error } : {}),
          ...(responseObj?.meta ? { ...responseObj.meta } : {}),
        };
      }
    }
    // Xử lý các exception không phải HttpException
    else {
      errorMessage = 'Internal server error';
      metaData = {
        message: errorMessage,
      };
    }

    const apiResponse: ApiResponse = {
      status: {
        code: status,
        message: errorMessage,
        ...(metaData ? { meta: metaData } : {}),
      },
      data: null,
    };

    response.status(status).json(apiResponse);
  }
}
