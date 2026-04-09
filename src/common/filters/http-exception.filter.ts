import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { AppException } from '@common/exception/AppException';
import { ApiResponse } from '@common/types/api-response.types';
import { DeviceRegistrationCleanupFilter } from './device-registration-cleanup.filter';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(
    private readonly deviceRegistrationCleanupFilter: DeviceRegistrationCleanupFilter,
  ) {}

  async catch(exception: unknown, host: ArgumentsHost): Promise<void> {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

    // Clear Redis key for device registration if register endpoint fails
    await this.deviceRegistrationCleanupFilter.catch(exception, host);

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let errorMessage = 'Internal server error';
    let metaData: any = undefined;

    if (AppException.isAppException(exception)) {
      errorMessage = exception.getErrorMessage();
      metaData = {
        errorCode: exception.getErrorCode(),
        message: exception.getErrorMessage(),
        ...(exception.getErrorMeta() || {}),
      };
    } else if (exception instanceof HttpException) {
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        errorMessage = exceptionResponse;
      } else {
        const responseObj = exceptionResponse as any;
        errorMessage = responseObj?.message || exception.message;
      }
    } else {
      errorMessage = 'Internal server error';
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
