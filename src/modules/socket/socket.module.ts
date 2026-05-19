import { Global, Module, forwardRef } from '@nestjs/common';
import { SocketGateway } from './socket.gateway';
import { SocketService } from './socket.service';
import { PresenceService } from './presence.service';
import { PresenceController } from './presence.controller';
import { RelationshipsModule } from '@modules/relationships/relationships.module';
import { ChatModule } from '@modules/chat/chat.module';

@Global()
@Module({
  imports: [RelationshipsModule, forwardRef(() => ChatModule)],
  controllers: [PresenceController],
  providers: [SocketGateway, SocketService, PresenceService],
  exports: [SocketService, PresenceService],
})
export class SocketModule {}
