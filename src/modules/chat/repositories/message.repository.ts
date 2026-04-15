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
import {
  AttachmentDto,
  MessageType,
  SendMessageDto,
} from '../dto/send-message.dto';
import {
  AttachmentResponse,
  MessageResponse,
  PaginatedMessages,
} from '../interfaces/message.response';

type DrizzleClient = PostgresJsDatabase<typeof schema>;

@Injectable()
export class MessageRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleClient) {}

  async insertMessage(
    dto: SendMessageDto & { conversationId: string; senderId: string },
  ): Promise<MessageResponse> {
    // ON CONFLICT (client_uuid) DO NOTHING RETURNING *
    // If conflict (offline retry): query by client_uuid and return existing row
    const inserted = await this.db
      .insert(schema.messages)
      .values({
        conversationId: dto.conversationId,
        senderId: dto.senderId,
        clientUuid: dto.clientUuid,
        type: dto.type as 'text' | 'image' | 'sticker' | 'gif',
        content: dto.content ?? null,
        replyToId: dto.replyToId ?? null,
      })
      .onConflictDoNothing()
      .returning();

    if (inserted.length > 0) {
      return this.toMessageResponse(inserted[0], null, []);
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

    const attachments = await this.db
      .select()
      .from(schema.messageAttachments)
      .where(eq(schema.messageAttachments.messageId, existing[0].id));

    return this.toMessageResponse(existing[0], null, attachments);
  }

  async insertAttachments(messageId: string, attachments: AttachmentDto[]) {
    if (!attachments.length) return;
    await this.db.insert(schema.messageAttachments).values(
      attachments.map((a) => ({
        messageId,
        mediaKey: a.mediaKey,
        mimeType: a.mimeType,
        width: a.width ?? null,
        height: a.height ?? null,
      })),
    );
  }

  async softDelete(messageId: string, requesterId: string): Promise<void> {
    const rows = await this.db
      .update(schema.messages)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(schema.messages.id, messageId),
          eq(schema.messages.senderId, requesterId),
          isNull(schema.messages.deletedAt),
        ),
      )
      .returning({ id: schema.messages.id });

    if (!rows.length) {
      // Could be not found or not the sender — treat as forbidden
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
      .select({
        message: schema.messages,
        attachment: schema.messageAttachments,
      })
      .from(schema.messages)
      .leftJoin(
        schema.messageAttachments,
        eq(schema.messageAttachments.messageId, schema.messages.id),
      )
      .where(whereClause)
      .orderBy(desc(schema.messages.createdAt), desc(schema.messages.id))
      .limit(limit + 1);

    // Group attachments per message
    const messageMap = new Map<
      string,
      {
        message: (typeof rows)[0]['message'];
        attachments: (typeof rows)[0]['attachment'][];
      }
    >();
    for (const row of rows) {
      if (!messageMap.has(row.message.id)) {
        messageMap.set(row.message.id, {
          message: row.message,
          attachments: [],
        });
      }
      if (row.attachment) {
        messageMap.get(row.message.id)!.attachments.push(row.attachment);
      }
    }

    const unique = [...messageMap.values()];
    const hasMore = unique.length > limit;
    const page = hasMore ? unique.slice(0, limit) : unique;

    // Fetch reply previews for messages that have replyToId
    const replyIds = [
      ...new Set(page.map((m) => m.message.replyToId).filter(Boolean)),
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

    const data = page.map(({ message, attachments }) => {
      const reply = message.replyToId
        ? (replyMap.get(message.replyToId) ?? null)
        : null;
      return this.toMessageResponse(
        message,
        reply,
        attachments.filter(
          Boolean,
        ) as (typeof schema.messageAttachments.$inferSelect)[],
      );
    });

    const lastRow = page[page.length - 1];
    const nextCursor =
      hasMore && lastRow
        ? encodeChatCursor({
            createdAt: lastRow.message.createdAt,
            id: lastRow.message.id,
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
      .select({
        message: schema.messages,
        attachment: schema.messageAttachments,
      })
      .from(schema.pinnedMessages)
      .innerJoin(
        schema.messages,
        eq(schema.pinnedMessages.messageId, schema.messages.id),
      )
      .leftJoin(
        schema.messageAttachments,
        eq(schema.messageAttachments.messageId, schema.messages.id),
      )
      .where(eq(schema.pinnedMessages.conversationId, convId))
      .orderBy(asc(schema.pinnedMessages.pinnedAt));

    const messageMap = new Map<
      string,
      {
        message: (typeof rows)[0]['message'];
        attachments: (typeof rows)[0]['attachment'][];
      }
    >();
    for (const row of rows) {
      if (!messageMap.has(row.message.id)) {
        messageMap.set(row.message.id, {
          message: row.message,
          attachments: [],
        });
      }
      if (row.attachment) {
        messageMap.get(row.message.id)!.attachments.push(row.attachment);
      }
    }

    return [...messageMap.values()].map(({ message, attachments }) =>
      this.toMessageResponse(
        message,
        null,
        attachments.filter(
          Boolean,
        ) as (typeof schema.messageAttachments.$inferSelect)[],
      ),
    );
  }

  async findLastMessagesBatch(
    convIds: string[],
  ): Promise<Map<string, MessageResponse>> {
    if (!convIds.length) return new Map();

    // DISTINCT ON (conversation_id) with ORDER BY conversation_id, created_at DESC, id DESC
    // → one row per conversation: the latest non-deleted message.
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

    if (!lastMessages.length) return new Map();

    const messageIds = lastMessages.map((m) => m.id);

    // Batch-fetch attachments for all last messages in one query.
    const attachmentRows = await this.db
      .select()
      .from(schema.messageAttachments)
      .where(inArray(schema.messageAttachments.messageId, messageIds));

    const attachmentMap = new Map<
      string,
      (typeof schema.messageAttachments.$inferSelect)[]
    >();
    for (const att of attachmentRows) {
      const list = attachmentMap.get(att.messageId) ?? [];
      list.push(att);
      attachmentMap.set(att.messageId, list);
    }

    const result = new Map<string, MessageResponse>();
    for (const message of lastMessages) {
      const attachments = attachmentMap.get(message.id) ?? [];
      result.set(
        message.conversationId,
        this.toMessageResponse(message, null, attachments),
      );
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

    const attachments = await this.db
      .select()
      .from(schema.messageAttachments)
      .where(eq(schema.messageAttachments.messageId, messageId));

    return this.toMessageResponse(rows[0], null, attachments);
  }

  private toMessageResponse(
    message: typeof schema.messages.$inferSelect,
    reply: typeof schema.messages.$inferSelect | null,
    attachments: (typeof schema.messageAttachments.$inferSelect)[],
  ): MessageResponse {
    return {
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      clientUuid: message.clientUuid,
      type: message.type as MessageType,
      content: message.deletedAt ? null : message.content,
      isDeleted: !!message.deletedAt,
      replyTo: reply
        ? {
            id: reply.id,
            senderId: reply.senderId,
            content: reply.deletedAt ? null : reply.content,
            isDeleted: !!reply.deletedAt,
          }
        : null,
      attachments: attachments.map((a) => ({
        id: a.id,
        mediaKey: a.mediaKey,
        mimeType: a.mimeType,
        width: a.width,
        height: a.height,
      })) as AttachmentResponse[],
      pinnedAt: message.pinnedAt?.toISOString() ?? null,
      createdAt: message.createdAt.toISOString(),
    };
  }
}
