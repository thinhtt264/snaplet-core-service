DROP TABLE "message_attachments" CASCADE;--> statement-breakpoint
ALTER TABLE "messages" RENAME COLUMN "content" TO "text";--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "media_key" text;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "media_url" text;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "mime_type" text;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "width" integer;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "height" integer;--> statement-breakpoint
ALTER TABLE "messages" DROP COLUMN "type";--> statement-breakpoint
DROP TYPE "public"."message_type";--> statement-breakpoint
ALTER TABLE "messages"
  ADD CONSTRAINT "chk_message_has_content"
    CHECK (text IS NOT NULL OR media_key IS NOT NULL OR media_url IS NOT NULL),
  ADD CONSTRAINT "chk_message_mime_required"
    CHECK (
      (media_key IS NULL AND media_url IS NULL)
      OR mime_type IS NOT NULL
    );