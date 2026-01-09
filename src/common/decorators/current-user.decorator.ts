import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { BaseRequest } from '@common/types/request.types';

/**
 * Decorator để extract userId từ request.user
 * JwtAuthGuard sẽ đảm bảo request.user tồn tại
 * Usage: @CurrentUserId() userId: string
 */
export const CurrentUserId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<BaseRequest>();
    return request.user!.userId;
  },
);
