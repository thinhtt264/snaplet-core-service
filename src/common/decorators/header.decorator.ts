import {
  createParamDecorator,
  ExecutionContext,
  BadRequestException,
} from '@nestjs/common';

/**
 * Decorator để extract deviceId từ header X-Device-Id
 * Usage: @DeviceId() deviceId: string
 */
export const DeviceId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    const deviceId = request.headers['x-device-id'];

    if (!deviceId || deviceId.trim().length === 0) {
      throw new BadRequestException('DeviceId is required');
    }

    return deviceId;
  },
);
