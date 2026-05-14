import { Injectable, Logger } from '@nestjs/common';

const USER_ROOM_PREFIX = 'user:';

/** Nest `@WebSocketServer()` is typed as Server but runtime value is Namespace. */
type SocketNamespaceLike = {
  adapter: { rooms: Map<string, Set<string>> };
  to(room: string): { emit(event: string, payload: unknown): void };
};

@Injectable()
export class SocketService {
  private readonly logger = new Logger(SocketService.name);
  private rootServer: SocketNamespaceLike | null = null;
  private chatServer: SocketNamespaceLike | null = null;

  setServer(server: unknown): void {
    this.rootServer = server as SocketNamespaceLike;
  }

  setChatServer(server: unknown): void {
    this.chatServer = server as SocketNamespaceLike;
  }

  /**
   * True if the user has at least one socket in `user:{userId}` on `/` or `/chat`.
   */
  isUserConnected(userId: string): boolean {
    const roomName = this.getUserRoom(userId);
    const rootSize = this.getRoomMemberCount(this.rootServer, roomName);
    const chatSize = this.getRoomMemberCount(this.chatServer, roomName);
    return rootSize > 0 || chatSize > 0;
  }

  /**
   * Nest gateways inject a Namespace (`/` or `/chat`), not the root Server.
   * Namespace: `adapter.rooms`; root Server: `sockets.adapter.rooms`.
   * Using `namespace.sockets.adapter` throws because `sockets` is a Map.
   */
  private getRoomMemberCount(
    server: SocketNamespaceLike | null,
    roomName: string,
  ): number {
    if (!server) return 0;
    try {
      return server.adapter.rooms.get(roomName)?.size ?? 0;
    } catch (err) {
      this.logger.warn(
        `Presence check failed room=${roomName}: ${(err as Error).message}`,
      );
      return 0;
    }
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
}
