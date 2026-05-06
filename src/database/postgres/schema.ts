import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const conversations = pgTable(
  'conversations',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    // userA < userB (lexicographic sort) — enforces pair uniqueness
    userA: text('user_a').notNull(),
    userB: text('user_b').notNull(),
    // No FK to messages to avoid circular reference; enforced at app level
    userALastReadMsgId: uuid('user_a_last_read_msg_id'),
    userBLastReadMsgId: uuid('user_b_last_read_msg_id'),
    lastMessageAt: timestamp('last_message_at'),
    syncUpdatedAt: timestamp('sync_updated_at').defaultNow().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('idx_conv_pair').on(t.userA, t.userB),
    index('idx_conv_user_a').on(t.userA),
    index('idx_conv_user_b').on(t.userB),
  ],
);

export const messages = pgTable(
  'messages',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    // text: stores MongoDB ObjectId string directly
    senderId: text('sender_id').notNull(),
    clientUuid: uuid('client_uuid').notNull(),
    text: text('text'),
    mediaKey: text('media_key'),
    mediaUrl: text('media_url'),
    mimeType: text('mime_type'),
    width: integer('width'),
    height: integer('height'),
    replyToId: uuid('reply_to_id').references(() => messages.id, {
      onDelete: 'set null',
    }),
    pinnedAt: timestamp('pinned_at'),
    deletedAt: timestamp('deleted_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('idx_messages_client_uuid').on(t.clientUuid),
    index('idx_messages_conv_cursor').on(t.conversationId, t.createdAt, t.id),
    index('idx_messages_not_deleted')
      .on(t.conversationId)
      .where(sql`${t.deletedAt} IS NULL`),
  ],
);

export const pinnedMessages = pgTable(
  'pinned_messages',
  {
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    messageId: uuid('message_id')
      .notNull()
      .references(() => messages.id, { onDelete: 'cascade' }),
    pinnedBy: text('pinned_by').notNull(),
    pinnedAt: timestamp('pinned_at').defaultNow().notNull(),
  },
  (t) => [index('idx_pinned_conv').on(t.conversationId)],
);

export const archiveRefs = pgTable('archive_refs', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  month: text('month').notNull(),
  r2Key: text('r2_key').notNull(),
  rowCount: integer('row_count').notNull(),
  archivedAt: timestamp('archived_at').defaultNow().notNull(),
});
