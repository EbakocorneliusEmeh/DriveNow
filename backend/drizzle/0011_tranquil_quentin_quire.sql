CREATE TYPE "public"."fuel_type" AS ENUM('gasoline', 'diesel', 'electric', 'hybrid');--> statement-breakpoint
CREATE TYPE "public"."transmission_type" AS ENUM('automatic', 'manual');--> statement-breakpoint
CREATE TYPE "public"."vehicle_type" AS ENUM('sedan', 'suv', 'truck', 'van', 'coupe', 'convertible');--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "vehicle_type" "vehicle_type";--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "transmission" "transmission_type";--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "fuel_type" "fuel_type";--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "seating_capacity" integer;