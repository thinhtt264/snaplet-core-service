import { INestApplicationContext, Logger } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';

/**
 * Socket.IO adapter that uses existing Redis pub/sub clients.
 * SubClient gets an 'error' handler to avoid unhandled rejection warnings.
 */
export class RedisSocketIoAdapter extends IoAdapter {
  private readonly logger = new Logger(RedisSocketIoAdapter.name);

  constructor(
    app: INestApplicationContext,
    private readonly pubClient: Redis,
    private readonly subClient: Redis,
  ) {
    super(app);
    this.subClient.on('error', (err) => {
      this.logger.debug(`Redis subClient error: ${err.message}`);
    });
  }

  override createIOServer(port: number, options?: any): any {
    const server: Server = super.createIOServer(port, options);
    server.adapter(createAdapter(this.pubClient, this.subClient));
    return server;
  }
}

/**
 * Create and return a Redis-backed Socket.IO adapter using the app's Redis client.
 * Call from main.ts: app.useWebSocketAdapter(createRedisSocketIoAdapter(app));
 */
export function createRedisSocketIoAdapter(
  app: INestApplicationContext,
): RedisSocketIoAdapter {
  const redis = app.get<Redis>('REDIS_CLIENT');
  const subClient = redis.duplicate();
  return new RedisSocketIoAdapter(app, redis, subClient);
}
