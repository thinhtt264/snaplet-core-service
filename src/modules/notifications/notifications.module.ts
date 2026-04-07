import { Module } from '@nestjs/common';
import { UsersModule } from '@modules/users/users.module';
import { FcmService } from './services/fcm.service';
import { NotificationQueueService } from './queue/notification-queue.service';
import { NotificationProcessor } from './queue/notification.processor';
import { NotificationListener } from './listeners/notification.listener';

@Module({
  imports: [UsersModule],
  providers: [
    FcmService,
    NotificationQueueService,
    NotificationProcessor,
    NotificationListener,
  ],
})
export class NotificationsModule {}
