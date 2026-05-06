ALTER TABLE "conversations"
ADD COLUMN IF NOT EXISTS "sync_updated_at" timestamp;--> statement-breakpoint

UPDATE "conversations"
SET "sync_updated_at" = COALESCE("last_message_at", "created_at")
WHERE "sync_updated_at" IS NULL;--> statement-breakpoint

ALTER TABLE "conversations"
ALTER COLUMN "sync_updated_at" SET DEFAULT now();--> statement-breakpoint

ALTER TABLE "conversations"
ALTER COLUMN "sync_updated_at" SET NOT NULL;--> statement-breakpoint
