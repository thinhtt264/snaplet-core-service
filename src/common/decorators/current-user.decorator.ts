import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Decorator để extract userId từ request.user
 * Guard sẽ đảm bảo request.user tồn tại
 * Usage: @CurrentUserId() userId: string
 */
export const CurrentUserId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    return request.user.userId;
  },
);
