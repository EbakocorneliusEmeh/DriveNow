CREATE TYPE "public"."vehicle_approval_status" AS ENUM('not_submitted', 'pending', 'approved', 'rejected');--> statement-breakpoint
ALTER TABLE "dealer_profiles" ADD COLUMN "approval_reason" text;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "approval_status" "vehicle_approval_status" DEFAULT 'approved' NOT NULL;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "approval_reason" text;--> statement-breakpoint
UPDATE "vehicles" SET "approval_status" = 'not_submitted' WHERE "status" = 'draft';