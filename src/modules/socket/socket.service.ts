import { Injectable, Logger } from '@nestjs/common';

const USER_ROOM_PREFIX = 'user:';

/** Persisted on `socket.data` so `fetchSockets()` (incl. Redis adapter) can read userId. */
export interface RootSocketData {
  userId?: string;
}

/** Nest `@WebSocketServer()` is typed as Server but runtime value is Namespace. */
type SocketNamespaceLike = {
  to(room: string): { emit(event: string, payload: unknown): void };
  in(room: string): {
    fetchSockets(): Promise<Array<{ data: RootSocketData }>>;
  };
};

@Injectable()
export class SocketService {
  private readonly logger = new Logger(SocketService.name);
  private rootServer: SocketNamespaceLike | null = null;

  setServer(server: unknown): void {
    this.rootServer = server as SocketNamespaceLike;
  }

  /**
   * Emit event to a user's room (user:{userId}).
   * With Redis adapter: delivery works across instances — any server that has
   * sockets in this room will receive the message and emit to local sockets.
   * No-op if server not set. Fire-and-forget; errors are logged only.
   */
  emitToUser(userId: string, event: string, payload: unknown): void {
    if (!this.rootServer) return;
    const room = `${USER_ROOM_PREFIX}${userId}`;
    try {
      this.rootServer.to(room).emit(event, payload);
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

  /**
   * True if this user has at least one socket on `/` joined to `user:{userId}`.
   */
  async isUserPresentInUserRoom(userId: string): Promise<boolean> {
    if (!this.rootServer) return false;

    const room = this.getUserRoom(userId);
    try {
      const sockets = await this.rootServer.in(room).fetchSockets();
      return sockets.some((remote) => remote.data.userId === userId);
    } catch (err) {
      this.logger.warn(
        `User room presence check failed room=${room}: ${(err as Error).message}`,
      );
      return false;
    }
  }
}
