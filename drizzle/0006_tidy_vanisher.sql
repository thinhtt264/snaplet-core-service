ALTER TABLE "messages" ALTER COLUMN "media_status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "messages" ALTER COLUMN "media_status" DROP NOT NULL;