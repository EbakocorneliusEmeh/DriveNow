CREATE TYPE "public"."vehicle_listing_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TABLE "vehicles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dealer_profile_id" uuid NOT NULL,
	"make" text NOT NULL,
	"model" text NOT NULL,
	"year" integer NOT NULL,
	"daily_rate" integer NOT NULL,
	"location" text NOT NULL,
	"description" text NOT NULL,
	"image_urls" jsonb NOT NULL,
	"status" "vehicle_listing_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_dealer_profile_id_dealer_profiles_id_fk" FOREIGN KEY ("dealer_profile_id") REFERENCES "public"."dealer_profiles"("id") ON DELETE cascade ON UPDATE no action;