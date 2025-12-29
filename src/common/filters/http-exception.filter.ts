import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

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

    if (exception instanceof HttpException) {
      const exceptionResponse = exception.getResponse();
      errorMessage =
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : (exceptionResponse as any)?.message || exception.message;
      metaData = (exceptionResponse as any)?.meta || undefined;
    }

    response.status(status).json({
      status: {
        code: status,
        message: errorMessage,
        meta: metaData,
      },
      data: null,
    });
  }
}
