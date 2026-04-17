import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  primaryKey,
  pgEnum,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const messageTypeEnum = pgEnum('message_type', [
  'text',
  'image',
  'sticker',
  'gif',
]);

export const conversations = pgTable('conversations', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  lastMessageAt: timestamp('last_message_at'),
});

export const conversationMembers = pgTable(
  'conversation_members',
  {
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    // text: stores MongoDB ObjectId string directly
    userId: text('user_id').notNull(),
    lastReadMessageId: uuid('last_read_message_id'),
    joinedAt: timestamp('joined_at').defaultNow().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.conversationId, t.userId] }),
    index('idx_conv_members_user').on(t.userId),
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
    type: messageTypeEnum('type').notNull().default('text'),
    content: text('content'),
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

// FK from conversationMembers.lastReadMessageId → messages.id (set null on delete)
// Defined after messages table to avoid forward reference issue
export const conversationMembersRelations = {
  lastReadMessageId: conversationMembers.lastReadMessageId,
};

export const messageAttachments = pgTable('message_attachments', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  messageId: uuid('message_id')
    .notNull()
    .references(() => messages.id, { onDelete: 'cascade' }),
  mediaKey: text('media_key').notNull(),
  mimeType: text('mime_type').notNull(),
  width: integer('width'),
  height: integer('height'),
});

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
  (t) => [
    primaryKey({ columns: [t.conversationId, t.messageId] }),
    index('idx_pinned_conv').on(t.conversationId),
  ],
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
