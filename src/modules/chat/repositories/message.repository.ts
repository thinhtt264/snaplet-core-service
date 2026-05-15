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
import {
  MessageResponse,
  PaginatedMessages,
} from '../interfaces/message.response';

interface InsertMessageParams {
  conversationId: string;
  senderId: string;
  clientUuid: string;
  text?: string | null;
  mediaKey?: string | null;
  mediaUrl?: string | null;
  mimeType?: string | null;
  width?: number | null;
  height?: number | null;
  replyToId?: string | null;
}

type DrizzleClient = PostgresJsDatabase<typeof schema>;
type MessageMediaStatus = 'AVAILABLE' | 'SOURCE_DELETED';

@Injectable()
export class MessageRepository {
  constructor(
    @Inject(DRIZZLE_CLIENT) private readonly db: DrizzleClient,
    private readonly storageService: StorageService,
  ) {}

  async insertMessage(params: InsertMessageParams): Promise<MessageResponse> {
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
    } = params;

    const storeKey =
      mediaKey != null && mediaKey.trim() !== '' ? mediaKey.trim() : null;
    const storeMime =
      mimeType != null && mimeType.trim() !== '' ? mimeType.trim() : null;

    const hasAttachment = storeKey != null || storeMime != null;
    const mediaStatus = hasAttachment ? ('AVAILABLE' as const) : null;

    const inserted = await this.db
      .insert(schema.messages)
      .values({
        conversationId,
        senderId,
        clientUuid,
        text,
        mediaKey: storeKey,
        mediaUrl,
        mimeType: storeMime,
        width,
        height,
        mediaStatus,
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
      .where(
        and(
          eq(schema.messages.clientUuid, params.clientUuid),
          eq(schema.messages.conversationId, params.conversationId),
          eq(schema.messages.senderId, params.senderId),
        ),
      )
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

  async markMediaSourceDeletedByKeys(mediaKeys: string[]): Promise<void> {
    const uniqueMediaKeys = Array.from(
      new Set(mediaKeys.map((key) => key.trim()).filter(Boolean)),
    );

    if (!uniqueMediaKeys.length) {
      return;
    }

    await this.db
      .update(schema.messages)
      .set({ mediaStatus: 'SOURCE_DELETED' })
      .where(inArray(schema.messages.mediaKey, uniqueMediaKeys));
  }

  private toMessageResponse(
    message: typeof schema.messages.$inferSelect,
    reply: typeof schema.messages.$inferSelect | null,
  ): MessageResponse {
    const isDeleted = !!message.deletedAt;
    const mediaKeyRaw = isDeleted ? null : message.mediaKey;
    const mediaUrlRaw = isDeleted ? null : message.mediaUrl;
    const mediaKey =
      mediaKeyRaw != null && mediaKeyRaw.trim() !== ''
        ? mediaKeyRaw.trim()
        : null;
    const mediaUrl =
      mediaUrlRaw != null && mediaUrlRaw.trim() !== ''
        ? mediaUrlRaw.trim()
        : null;
    const hasMedia = !isDeleted && (mediaKey != null || mediaUrl != null);

    let media: MessageResponse['media'] = null;
    if (hasMedia) {
      const mediaStatus: MessageMediaStatus =
        message.mediaStatus === 'SOURCE_DELETED'
          ? 'SOURCE_DELETED'
          : 'AVAILABLE';
      const isSourceDeleted = mediaStatus === 'SOURCE_DELETED';
      let urls: NonNullable<MessageResponse['media']>['urls'] = {
        original: '',
        xs: '',
        sm: '',
        md: '',
        xl: '',
      };

      if (mediaKey && !isSourceDeleted) {
        const original = this.storageService.getDefaultImageUrl(mediaKey);
        const sized = this.storageService.getImageUrls(mediaKey, [
          ImageSizeKey.SM,
          ImageSizeKey.MD,
        ]);
        urls = {
          original,
          xs: '',
          sm: sized?.[ImageSizeKey.SM] ?? '',
          md: sized?.[ImageSizeKey.MD] ?? '',
          xl: '',
        };
      } else if (mediaUrl) {
        urls.original = mediaUrl;
      }

      media = {
        urls,
        mimeType: isDeleted ? null : message.mimeType,
        width: isDeleted ? null : (message.width ?? null),
        height: isDeleted ? null : (message.height ?? null),
        status: mediaStatus,
      };
    }

    return {
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      clientUuid: message.clientUuid,
      text: isDeleted ? null : message.text,
      media,
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
      reactions: [],
    };
  }
}
