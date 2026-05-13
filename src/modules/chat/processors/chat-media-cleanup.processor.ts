import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Worker, type Job } from 'bullmq';
import { RedisService } from '@common/redis/redis.service';
import { MessageRepository } from '../repositories/message.repository';
import {
  CHAT_MEDIA_CLEANUP_JOB_MARK_SOURCE_DELETED,
  CHAT_MEDIA_CLEANUP_QUEUE_NAME,
} from '../queue/chat-media-cleanup.queue.constants';
import { ChatMediaCleanupMarkSourceDeletedJobData } from '../queue/chat-media-cleanup.queue.types';

@Injectable()
export class ChatMediaCleanupProcessor
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(ChatMediaCleanupProcessor.name);
  private worker: Worker | null = null;
  private readonly connection: any;

  constructor(
    private readonly redisService: RedisService,
    private readonly messageRepository: MessageRepository,
  ) {
    this.connection = this.redisService.getClient().duplicate();
  }

  onModuleInit(): void {
    this.worker = new Worker(
      CHAT_MEDIA_CLEANUP_QUEUE_NAME,
      async (job: Job) => this.processJob(job),
      {
        connection: this.connection,
        concurrency: 3,
      },
    );

    this.worker.on('error', (error) => {
      this.logger.warn(`Chat media cleanup worker error: ${error.message}`);
    });
  }

  private async processJob(job: Job): Promise<void> {
    if (job.name !== CHAT_MEDIA_CLEANUP_JOB_MARK_SOURCE_DELETED) {
      this.logger.warn(`Unknown chat media cleanup job: ${String(job.name)}`);
      return;
    }

    const data = job.data as ChatMediaCleanupMarkSourceDeletedJobData;
    await this.messageRepository.markMediaSourceDeletedByKeys(data.mediaKeys);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
    }
    await this.connection.quit();
  }
}
