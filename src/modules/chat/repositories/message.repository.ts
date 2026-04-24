import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, desc, eq, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE_CLIENT } from '@database/postgres/postgres.provider';
import * as schema from '@database/postgres/schema';
import {
  encodeChatCursor,
  parseChatCursor,
} from '@common/types/chat-cursor.types';
import { CHAT_MESSAGE_PAGE_SIZE } from '@common/constants/chat.constants';
import { ImageSizeKey } from '@common/types';
import { StorageService } from '@infrastructure/storage/storage.service';
import { SendMessageDto } from '../dto/send-message.dto';
import {
  MessageResponse,
  PaginatedMessages,
} from '../interfaces/message.response';

type DrizzleClient = PostgresJsDatabase<typeof schema>;

@Injectable()
export class MessageRepository {
  constructor(
    @Inject(DRIZZLE_CLIENT) private readonly db: DrizzleClient,
    private readonly storageService: StorageService,
  ) {}

  async insertMessage(
    dto: SendMessageDto & { conversationId: string; senderId: string },
  ): Promise<MessageResponse> {
    const {
      conversationId,
      senderId,
      clientUuid,
      text = null,
      mediaKey = null,
      mediaUrl = null,
      mimeType = null,
      width = null,
      height = null,
      replyToId = null,
    } = dto;

    const inserted = await this.db
      .insert(schema.messages)
      .values({
        conversationId,
        senderId,
        clientUuid,
        text,
        mediaKey,
        mediaUrl,
        mimeType,
        width,
        height,
        replyToId,
      })
      .onConflictDoNothing()
      .returning();

    if (inserted.length > 0) {
      return this.toMessageResponse(inserted[0], null);
    }

    // Conflict: offline retry — return existing row
    const existing = await this.db
      .select()
      .from(schema.messages)
      .where(eq(schema.messages.clientUuid, dto.clientUuid))
      .limit(1);

    if (!existing.length) {
      throw new NotFoundException('Message not found after conflict');
    }

    return this.toMessageResponse(existing[0], null);
  }

  async hardDelete(messageId: string, requesterId: string): Promise<void> {
    const rows = await this.db
      .delete(schema.messages)
      .where(
        and(
          eq(schema.messages.id, messageId),
          eq(schema.messages.senderId, requesterId),
        ),
      )
      .returning({ id: schema.messages.id });

    if (!rows.length) {
      throw new ForbiddenException('Cannot delete this message');
    }
  }

  async findByConversation(
    convId: string,
    cursor?: string,
    limit: number = CHAT_MESSAGE_PAGE_SIZE,
  ): Promise<PaginatedMessages> {
    const parsed = parseChatCursor(cursor);

    const whereClause = and(
      eq(schema.messages.conversationId, convId),
      isNull(schema.messages.deletedAt),
      parsed
        ? or(
            lt(schema.messages.createdAt, parsed.createdAt),
            and(
              eq(schema.messages.createdAt, parsed.createdAt),
              lt(schema.messages.id, parsed.id),
            ),
          )
        : undefined,
    );

    const rows = await this.db
      .select()
      .from(schema.messages)
      .where(whereClause)
      .orderBy(desc(schema.messages.createdAt), desc(schema.messages.id))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    // Fetch reply previews for messages that have replyToId
    const replyIds = [
      ...new Set(page.map((m) => m.replyToId).filter(Boolean)),
    ] as string[];
    const replyMap = new Map<string, typeof schema.messages.$inferSelect>();
    if (replyIds.length > 0) {
      const replies = await this.db
        .select()
        .from(schema.messages)
        .where(sql`${schema.messages.id} = ANY(${replyIds})`);
      for (const r of replies) {
        replyMap.set(r.id, r);
      }
    }

    const data = page.map((message) => {
      const reply = message.replyToId
        ? (replyMap.get(message.replyToId) ?? null)
        : null;
      return this.toMessageResponse(message, reply);
    });

    const lastRow = page[page.length - 1];
    const nextCursor =
      hasMore && lastRow
        ? encodeChatCursor({
            createdAt: lastRow.createdAt,
            id: lastRow.id,
          })
        : null;

    return { data, pagination: { limit, nextCursor } };
  }

  async pinMessage(
    convId: string,
    messageId: string,
    pinnedBy: string,
  ): Promise<void> {
    await this.db
      .insert(schema.pinnedMessages)
      .values({ conversationId: convId, messageId, pinnedBy })
      .onConflictDoNothing();

    await this.db
      .update(schema.messages)
      .set({ pinnedAt: new Date() })
      .where(eq(schema.messages.id, messageId));
  }

  async unpinMessage(convId: string, messageId: string): Promise<void> {
    await this.db
      .delete(schema.pinnedMessages)
      .where(
        and(
          eq(schema.pinnedMessages.conversationId, convId),
          eq(schema.pinnedMessages.messageId, messageId),
        ),
      );

    await this.db
      .update(schema.messages)
      .set({ pinnedAt: null })
      .where(eq(schema.messages.id, messageId));
  }

  async findPinned(convId: string): Promise<MessageResponse[]> {
    const rows = await this.db
      .select({ message: schema.messages })
      .from(schema.pinnedMessages)
      .innerJoin(
        schema.messages,
        eq(schema.pinnedMessages.messageId, schema.messages.id),
      )
      .where(eq(schema.pinnedMessages.conversationId, convId))
      .orderBy(asc(schema.pinnedMessages.pinnedAt));

    return rows.map(({ message }) => this.toMessageResponse(message, null));
  }

  async findLastMessagesBatch(
    convIds: string[],
  ): Promise<Map<string, MessageResponse>> {
    if (!convIds.length) return new Map();

    const lastMessages = await this.db
      .selectDistinctOn([schema.messages.conversationId])
      .from(schema.messages)
      .where(
        and(
          inArray(schema.messages.conversationId, convIds),
          isNull(schema.messages.deletedAt),
        ),
      )
      .orderBy(
        schema.messages.conversationId,
        desc(schema.messages.createdAt),
        desc(schema.messages.id),
      );

    const result = new Map<string, MessageResponse>();
    for (const message of lastMessages) {
      result.set(message.conversationId, this.toMessageResponse(message, null));
    }
    return result;
  }

  async findById(messageId: string): Promise<MessageResponse | null> {
    const rows = await this.db
      .select()
      .from(schema.messages)
      .where(eq(schema.messages.id, messageId))
      .limit(1);

    if (!rows.length) return null;

    return this.toMessageResponse(rows[0], null);
  }

  private toMessageResponse(
    message: typeof schema.messages.$inferSelect,
    reply: typeof schema.messages.$inferSelect | null,
  ): MessageResponse {
    const isDeleted = !!message.deletedAt;
    const mediaKey = isDeleted ? null : message.mediaKey;

    let mediaUrls: MessageResponse['mediaUrls'] = null;
    if (mediaKey) {
      const original = this.storageService.getDefaultImageUrl(mediaKey);
      const urls = this.storageService.getImageUrls(mediaKey, [
        ImageSizeKey.XS,
        ImageSizeKey.SM,
      ]);
      mediaUrls = {
        original,
        xs: urls?.[ImageSizeKey.XS] ?? '',
        sm: urls?.[ImageSizeKey.SM] ?? '',
        md: '',
        xl: '',
      };
    }

    return {
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      clientUuid: message.clientUuid,
      text: isDeleted ? null : message.text,
      mediaUrls,
      mimeType: isDeleted ? null : message.mimeType,
      isDeleted,
      replyTo: reply
        ? {
            id: reply.id,
            senderId: reply.senderId,
            text: reply.deletedAt ? null : reply.text,
            isDeleted: !!reply.deletedAt,
          }
        : null,
      pinnedAt: message.pinnedAt ?? null,
      createdAt: message.createdAt,
    };
  }
}
