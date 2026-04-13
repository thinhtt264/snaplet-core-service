import { Module, OnModuleInit } from '@nestjs/common';
import { PostgresModule } from '@database/postgres/postgres.module';
import { StorageModule } from '@infrastructure/storage/storage.module';
import { UsersModule } from '@modules/users/users.module';
import { CommonJwtModule } from '@common/jwt/jwt.module';
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
  imports: [PostgresModule, StorageModule, UsersModule, CommonJwtModule],
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
export class ChatModule implements OnModuleInit {
  constructor(
    private readonly gateway: ChatGateway,
    private readonly typingService: TypingService,
    private readonly readReceiptService: ReadReceiptService,
    private readonly conversationRepository: ConversationRepository,
  ) {}

  onModuleInit(): void {
    // Wire up circular references after all providers are initialized
    this.gateway.setTypingService(this.typingService);
    this.gateway.setReadReceiptService(this.readReceiptService);
    this.gateway.setConversationRepository(this.conversationRepository);
  }
}
