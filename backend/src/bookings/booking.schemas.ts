import { z } from "zod";

export const bookingRequestSchema = z.object({
  vehicleId: z.string().uuid(),
  startDate: z.iso.date(),
  endDate: z.iso.date(),
  message: z.string().trim().max(1_000).default(""),
}).refine((value) => value.endDate > value.startDate, {
  path: ["endDate"],
  message: "Return date must be after the pickup date.",
});

export const bookingStatusSchema = z.object({
  status: z.enum(["confirmed", "declined"]),
});

export const bookingCancellationSchema = z.object({
  reason: z.string().trim().max(1_000).optional().default(""),
});

export const bookingIdSchema = z.string().uuid();
