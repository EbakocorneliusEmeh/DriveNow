import { z } from "zod";

export const rentalStatus = z.enum(["pending", "approved", "rejected"]);

export const rentalIdSchema = z.string().uuid();

export const rentalInputSchema = z.object({
  vehicleId: z.string().uuid(),
  startDate: z.string().pipe(z.coerce.date()),
  endDate: z.string().pipe(z.coerce.date()),
});

export type RentalInput = z.infer<typeof rentalInputSchema>;