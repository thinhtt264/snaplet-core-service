import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const { method, url, ip } = request;
    const userAgent = request.get('user-agent') || '';
    const startTime = Date.now();

    // Log incoming request
    this.logger.log(`🔵  ${method} - ${url} - ${ip} - ${userAgent}`);

    // Log response when it finishes (after exception filter sets status code)
    response.once('finish', () => {
      const statusCode = response.statusCode;
      const responseTime = Date.now() - startTime;
      const isSuccess = statusCode >= 200 && statusCode < 300;
      const icon = isSuccess ? '🟢' : '🔴';

      this.logger.log(
        `${icon}  ${method} - ${url} - ${statusCode} - ${responseTime}ms`,
      );
    });

    return next.handle();
  }
}
