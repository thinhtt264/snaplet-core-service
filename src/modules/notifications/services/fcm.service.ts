import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

@Injectable()
export class FcmService implements OnModuleInit {
  private readonly logger = new Logger(FcmService.name);
  private messaging: admin.messaging.Messaging | null = null;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const projectId = this.configService.get<string>('firebase.projectId');
    const clientEmail = this.configService.get<string>('firebase.clientEmail');
    const privateKey = this.configService.get<string>('firebase.privateKey');
    if (!projectId || !clientEmail || !privateKey) {
      this.logger.warn('Firebase admin not initialized: missing credentials');
      return;
    }
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
    }
    this.messaging = admin.messaging();
  }

  async sendPush(params: {
    token: string;
    title: string;
    body: string;
    data?: Record<string, string>;
  }): Promise<{ success: boolean; shouldDeleteToken: boolean }> {
    if (!this.messaging) {
      this.logger.warn('FCM messaging unavailable (not initialized)');
      return { success: false, shouldDeleteToken: false };
    }
    try {
      // FCM requires string values; Android clients read keys like `postId` from
      // `RemoteMessage.data`. Mirroring the same map under `android.data` improves
      // delivery when a notification block is also present.
      const dataPayload: Record<string, string> = Object.fromEntries(
        Object.entries(params.data ?? {}).map(([k, v]) => [
          k,
          v == null ? '' : String(v),
        ]),
      );

      await this.messaging.send({
        token: params.token,
        notification: undefined,
        data: {
          ...dataPayload,
          ...(params.title && { title: params.title }),
          ...(params.body && { body: params.body }),
        },
        android: {
          priority: 'high',
          data: dataPayload,
        },
        apns: {
          payload: {
            aps: {
              contentAvailable: true,
            },
          },
        },
      });
      return { success: true, shouldDeleteToken: false };
    } catch (error: unknown) {
      const code =
        error && typeof error === 'object' && 'code' in error
          ? String((error as { code: string }).code)
          : '';
      const invalidTokenCodes = [
        'messaging/invalid-registration-token',
        'messaging/registration-token-not-registered',
      ];
      const shouldDeleteToken = invalidTokenCodes.includes(code);
      this.logger.warn(
        `FCM send failed — code: ${code}, shouldDelete: ${shouldDeleteToken}`,
      );
      return { success: false, shouldDeleteToken };
    }
  }
}
