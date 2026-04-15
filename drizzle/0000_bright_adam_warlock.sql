CREATE TYPE "public"."message_type" AS ENUM('text', 'image', 'sticker', 'gif');--> statement-breakpoint
CREATE TABLE "archive_refs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"month" text NOT NULL,
	"r2_key" text NOT NULL,
	"row_count" integer NOT NULL,
	"archived_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversation_members" (
	"conversation_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"last_read_message_id" uuid,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "conversation_members_conversation_id_user_id_pk" PRIMARY KEY("conversation_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_message_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "message_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"media_key" text NOT NULL,
	"mime_type" text NOT NULL,
	"width" integer,
	"height" integer
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"sender_id" text NOT NULL,
	"client_uuid" uuid NOT NULL,
	"type" "message_type" DEFAULT 'text' NOT NULL,
	"content" text,
	"reply_to_id" uuid,
	"pinned_at" timestamp,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pinned_messages" (
	"conversation_id" uuid NOT NULL,
	"message_id" uuid NOT NULL,
	"pinned_by" text NOT NULL,
	"pinned_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pinned_messages_conversation_id_message_id_pk" PRIMARY KEY("conversation_id","message_id")
);
--> statement-breakpoint
ALTER TABLE "conversation_members" ADD CONSTRAINT "conversation_members_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_attachments" ADD CONSTRAINT "message_attachments_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_reply_to_id_messages_id_fk" FOREIGN KEY ("reply_to_id") REFERENCES "public"."messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pinned_messages" ADD CONSTRAINT "pinned_messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pinned_messages" ADD CONSTRAINT "pinned_messages_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_conv_members_user" ON "conversation_members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_messages_client_uuid" ON "messages" USING btree ("client_uuid");--> statement-breakpoint
CREATE INDEX "idx_messages_conv_cursor" ON "messages" USING btree ("conversation_id","created_at","id");--> statement-breakpoint
CREATE INDEX "idx_messages_not_deleted" ON "messages" USING btree ("conversation_id") WHERE "messages"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_pinned_conv" ON "pinned_messages" USING btree ("conversation_id");