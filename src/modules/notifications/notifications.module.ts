import { Module, forwardRef } from '@nestjs/common';
import { UsersModule } from '@modules/users/users.module';
import { SocketModule } from '@modules/socket/socket.module';
import { ChatModule } from '@modules/chat/chat.module';
import { FcmService } from './services/fcm.service';
import { NotificationQueueService } from './queue/notification-queue.service';
import { NotificationProcessor } from './queue/notification.processor';
import { NotificationListener } from './listeners/notification.listener';

@Module({
  imports: [UsersModule, SocketModule, forwardRef(() => ChatModule)],
  providers: [
    FcmService,
    NotificationQueueService,
    NotificationProcessor,
    NotificationListener,
  ],
  exports: [NotificationQueueService],
})
export class NotificationsModule {}
