CREATE TABLE IF NOT EXISTS "message_reactions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "message_id" uuid NOT NULL,
  "user_id" text NOT NULL,
  "emoji" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "message_reactions"
ADD CONSTRAINT "message_reactions_message_id_messages_id_fk"
FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id")
ON DELETE CASCADE ON UPDATE NO ACTION;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_message_reactions_message_user"
ON "message_reactions" USING btree ("message_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_message_reactions_message_id"
ON "message_reactions" USING btree ("message_id");--> statement-breakpoint
