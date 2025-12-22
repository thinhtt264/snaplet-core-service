import {
  createParamDecorator,
  ExecutionContext,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';

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

export const AccessToken = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Authorization header is required');
    }

    const token = authHeader.substring(7);

    if (!token || token.trim().length === 0) {
      throw new UnauthorizedException('Access token is required');
    }

    return token;
  },
);
