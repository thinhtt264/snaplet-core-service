CREATE TABLE "archive_refs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"month" text NOT NULL,
	"r2_key" text NOT NULL,
	"row_count" integer NOT NULL,
	"archived_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_a" text NOT NULL,
	"user_b" text NOT NULL,
	"user_a_last_read_msg_id" uuid,
	"user_b_last_read_msg_id" uuid,
	"last_message_at" timestamp,
	"sync_updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_reactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"emoji" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"sender_id" text NOT NULL,
	"client_uuid" uuid NOT NULL,
	"text" text,
	"media_key" text,
	"media_url" text,
	"mime_type" text,
	"width" integer,
	"height" integer,
	"media_status" text,
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
	"pinned_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "message_reactions" ADD CONSTRAINT "message_reactions_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_reply_to_id_messages_id_fk" FOREIGN KEY ("reply_to_id") REFERENCES "public"."messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pinned_messages" ADD CONSTRAINT "pinned_messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pinned_messages" ADD CONSTRAINT "pinned_messages_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_conv_pair" ON "conversations" USING btree ("user_a","user_b");--> statement-breakpoint
CREATE INDEX "idx_conv_user_a" ON "conversations" USING btree ("user_a");--> statement-breakpoint
CREATE INDEX "idx_conv_user_b" ON "conversations" USING btree ("user_b");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_message_reactions_message_user" ON "message_reactions" USING btree ("message_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_message_reactions_message_id" ON "message_reactions" USING btree ("message_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_messages_client_uuid" ON "messages" USING btree ("client_uuid");--> statement-breakpoint
CREATE INDEX "idx_messages_conv_cursor" ON "messages" USING btree ("conversation_id","created_at","id");--> statement-breakpoint
CREATE INDEX "idx_messages_not_deleted" ON "messages" USING btree ("conversation_id") WHERE "messages"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_pinned_conv" ON "pinned_messages" USING btree ("conversation_id");