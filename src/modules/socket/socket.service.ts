import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';

const USER_ROOM_PREFIX = 'user:';

@Injectable()
export class SocketService {
  private readonly logger = new Logger(SocketService.name);
  private server: Server | null = null;

  setServer(server: Server): void {
    this.server = server;
  }

  /**
   * Emit event to a user's room (user:{userId}).
   * With Redis adapter: delivery works across instances — any server that has
   * sockets in this room will receive the message and emit to local sockets.
   * No-op if server not set. Fire-and-forget; errors are logged only.
   */
  emitToUser(userId: string, event: string, payload: unknown): void {
    if (!this.server) return;
    const room = `${USER_ROOM_PREFIX}${userId}`;
    try {
      this.server.to(room).emit(event, payload);
      this.logger.debug(`Emitted ${event} to room=${room}`);
    } catch (err) {
      this.logger.warn(
        `Emit failed room=${room} event=${event}: ${(err as Error).message}`,
      );
    }
  }

  getUserRoom(userId: string): string {
    return `${USER_ROOM_PREFIX}${userId}`;
  }
}
