ALTER TABLE "conversation_members" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "conversation_members" CASCADE;--> statement-breakpoint
ALTER TABLE "pinned_messages" DROP CONSTRAINT "pinned_messages_conversation_id_message_id_pk";--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "user_a" text NOT NULL;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "user_b" text NOT NULL;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "user_a_last_read_msg_id" uuid;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "user_b_last_read_msg_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_conv_pair" ON "conversations" USING btree ("user_a","user_b");--> statement-breakpoint
CREATE INDEX "idx_conv_user_a" ON "conversations" USING btree ("user_a");--> statement-breakpoint
CREATE INDEX "idx_conv_user_b" ON "conversations" USING btree ("user_b");