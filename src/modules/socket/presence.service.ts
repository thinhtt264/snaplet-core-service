import { Injectable } from '@nestjs/common';
import { RedisService } from '@common/redis/redis.service';
import { userPresenceKey } from '@common/constants/redis-keys.constants';

@Injectable()
export class PresenceService {
  private readonly ttlSeconds = 300;

  constructor(private readonly redis: RedisService) {}

  async setOnline(userId: string): Promise<void> {
    await this.redis.set(userPresenceKey(userId), '1', this.ttlSeconds);
  }

  async setOffline(userId: string): Promise<void> {
    await this.redis.del(userPresenceKey(userId));
  }

  async isOnline(userId: string): Promise<boolean> {
    const value = await this.redis.get(userPresenceKey(userId));
    return value !== null;
  }

  async filterOnlineUserIds(userIds: string[]): Promise<string[]> {
    if (userIds.length === 0) return [];

    const keys = userIds.map(userPresenceKey);
    const values = await this.redis.mget(keys);
    return userIds.filter((_, index) => values[index] !== null);
  }
}
