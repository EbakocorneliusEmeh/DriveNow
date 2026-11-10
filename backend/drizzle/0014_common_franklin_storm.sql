CREATE TYPE "public"."presence_visibility" AS ENUM('everyone', 'contacts', 'nobody');--> statement-breakpoint
ALTER TABLE "chat_messages" ADD COLUMN "client_message_id" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "presence_visibility" "presence_visibility" DEFAULT 'contacts' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_seen_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "chat_messages_sender_client_message_id_unique" ON "chat_messages" USING btree ("sender_id","client_message_id");
--> statement-breakpoint
UPDATE "chat_messages" AS message
SET "delivered_at" = COALESCE(message."delivered_at", receipts."read_at"),
    "read_at" = receipts."read_at"
FROM (
  SELECT messages."id",
    CASE
      WHEN messages."sender_id" = bookings."customer_id" THEN conversations."dealer_last_read_at"
      ELSE conversations."customer_last_read_at"
    END AS "read_at"
  FROM "chat_messages" AS messages
  INNER JOIN "conversations" AS conversations ON conversations."id" = messages."conversation_id"
  INNER JOIN "bookings" AS bookings ON bookings."id" = conversations."booking_id"
) AS receipts
WHERE message."id" = receipts."id"
  AND receipts."read_at" IS NOT NULL
  AND message."created_at" <= receipts."read_at";