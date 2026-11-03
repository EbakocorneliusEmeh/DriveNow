import { z } from "zod";

const currentYear = new Date().getFullYear() + 1;

export const vehicleInputSchema = z.object({
  make: z.string().trim().min(2).max(80),
  model: z.string().trim().min(1).max(100),
  year: z.number().int().min(1950).max(currentYear),
  dailyRate: z.number().int().positive().max(10_000_000),
  location: z.string().trim().min(2).max(200),
  description: z.string().trim().min(10).max(2_000),
  imageUrls: z.array(z.url()).max(10),
});

export const vehicleStatusSchema = z.object({
  status: z.enum(["draft", "published"]),
});

export const vehicleIdSchema = z.string().uuid();

export type VehicleInput = z.infer<typeof vehicleInputSchema>;
