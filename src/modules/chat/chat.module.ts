import { Module } from '@nestjs/common';
import { PostgresModule } from '@database/postgres/postgres.module';
import { UsersModule } from '@modules/users/users.module';
import { RelationshipsModule } from '@modules/relationships/relationships.module';
import { CommonJwtModule } from '@common/jwt/jwt.module';
import { SocketModule } from '@modules/socket/socket.module';
import { ChatController } from './controllers/chat.controller';
import { ChatGateway } from './gateway/chat.gateway';
import { ConversationService } from './services/conversation.service';
import { MessageService } from './services/message.service';
import { TypingService } from './services/typing.service';
import { ReadReceiptService } from './services/read-receipt.service';
import { UnreadCountService } from './services/unread-count.service';
import { ConversationRepository } from './repositories/conversation.repository';
import { MessageRepository } from './repositories/message.repository';
import { ChatArchiveProcessor } from './processors/chat-archive.processor';

@Module({
  imports: [
    PostgresModule,
    UsersModule,
    RelationshipsModule,
    CommonJwtModule,
    SocketModule,
  ],
  controllers: [ChatController],
  providers: [
    ChatGateway,
    ConversationService,
    MessageService,
    TypingService,
    ReadReceiptService,
    UnreadCountService,
    ConversationRepository,
    MessageRepository,
    ChatArchiveProcessor,
  ],
  exports: [ConversationService, MessageService],
})
export class ChatModule {}
