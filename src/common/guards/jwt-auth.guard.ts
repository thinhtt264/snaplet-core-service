import {
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ModuleRef } from '@nestjs/core';
import { UserRepository } from '@modules/users/repositories/user.repository';
import type { Request } from 'express';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly moduleRef: ModuleRef) {
    super();
  }

  private isOnboardingRoute(req: Request): boolean {
    const method = (req.method || '').toUpperCase();
    if (method !== 'PATCH') return false;

    const url = (req.originalUrl || req.url || '').split('?')[0] || '';
    return url.endsWith('/users/me/complete-onboarding');
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const ok = (await super.canActivate(context)) as boolean;
    if (!ok) return false;

    if (context.getType() !== 'http') return true;

    const req = context.switchToHttp().getRequest<Request>();
    if (this.isOnboardingRoute(req)) return true;

    const authUser = (req as unknown as { user?: { userId?: string } }).user;
    const userId = authUser?.userId;
    if (!userId) return true;

    const userRepository = this.moduleRef.get(UserRepository, {
      strict: false,
    });
    if (!userRepository) return true;

    const user = await userRepository.findActiveById(userId);
    if (user?.isOnboardingComplete === false) {
      throw new ForbiddenException('ONBOARDING_REQUIRED');
    }

    return true;
  }
}
