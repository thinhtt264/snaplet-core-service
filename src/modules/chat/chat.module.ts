import { Module, forwardRef } from '@nestjs/common';
import { PostgresModule } from '@database/postgres/postgres.module';
import { UsersModule } from '@modules/users/users.module';
import { RelationshipsModule } from '@modules/relationships/relationships.module';
import { CommonJwtModule } from '@common/jwt/jwt.module';
import { SocketModule } from '@modules/socket/socket.module';
import { StorageModule } from '@infrastructure/storage/storage.module';
import { NotificationsModule } from '@modules/notifications/notifications.module';
import { ChatController } from './controllers/chat.controller';
import { MessageController } from './controllers/message.controller';
import { ChatGateway } from './gateway/chat.gateway';
import { ConversationService } from './services/conversation.service';
import { MessageService } from './services/message.service';
import { TypingService } from './services/typing.service';
import { ReadReceiptService } from './services/read-receipt.service';
import { ConversationRepository } from './repositories/conversation.repository';
import { MessageRepository } from './repositories/message.repository';
import { MessageReactionRepository } from './repositories/message-reaction.repository';
import { ChatArchiveProcessor } from './processors/chat-archive.processor';
import { ChatMediaCleanupProcessor } from './processors/chat-media-cleanup.processor';
import { ChatMediaCleanupQueueService } from './queue/chat-media-cleanup.queue.service';

@Module({
  imports: [
    PostgresModule,
    UsersModule,
    RelationshipsModule,
    CommonJwtModule,
    SocketModule,
    StorageModule,
    forwardRef(() => NotificationsModule),
  ],
  controllers: [ChatController, MessageController],
  providers: [
    ChatGateway,
    ConversationService,
    MessageService,
    TypingService,
    ReadReceiptService,
    ConversationRepository,
    MessageRepository,
    MessageReactionRepository,
    ChatArchiveProcessor,
    ChatMediaCleanupProcessor,
    ChatMediaCleanupQueueService,
  ],
  exports: [
    ChatGateway,
    ConversationService,
    MessageService,
    ChatMediaCleanupQueueService,
    ConversationRepository,
  ],
})
export class ChatModule {}
