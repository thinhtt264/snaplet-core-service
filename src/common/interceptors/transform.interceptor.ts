import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { API_RESPONSE_MESSAGE } from '../decorators/api-response.decorator';

export interface ResponseStatus {
  code: number;
  message: string;
}

export interface StandardResponse<T> {
  status: ResponseStatus;
  data: T;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  StandardResponse<T>
> {
  private readonly statusMessages: Record<number, string> = {
    [HttpStatus.OK]: 'Success',
    [HttpStatus.CREATED]: 'Created',
    [HttpStatus.ACCEPTED]: 'Accepted',
    [HttpStatus.NO_CONTENT]: 'No Content',
    [HttpStatus.PARTIAL_CONTENT]: 'Partial Content',
  };

  constructor(private reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<StandardResponse<T>> {
    return next.handle().pipe(
      map((data) => {
        const response = context.switchToHttp().getResponse();
        const statusCode = response.statusCode;

        // Ưu tiên message từ decorator
        const customMessage = this.reflector.get<string>(
          API_RESPONSE_MESSAGE,
          context.getHandler(),
        );

        // Nếu không có custom message, sử dụng message theo status code
        const message =
          customMessage ||
          this.statusMessages[statusCode] ||
          this.getDefaultStatusMessage(statusCode);

        return {
          status: {
            code: statusCode,
            message,
          },
          data,
        };
      }),
    );
  }

  private getDefaultStatusMessage(statusCode: number): string {
    const statusText = HttpStatus[statusCode];
    return statusText
      ? statusText.replace(/_/g, ' ').toLowerCase()
      : 'Unknown status';
  }
}
