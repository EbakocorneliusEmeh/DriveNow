import { z } from "zod";

const optionalUrl = z.union([z.url(), z.literal("")]).transform((value) => value || undefined);

export const dealerApplicationSchema = z.object({
  businessName: z.string().trim().min(2).max(160),
  businessEmail: z.string().trim().toLowerCase().email(),
  businessPhone: z.string().trim().min(7).max(30),
  businessAddress: z.string().trim().min(5).max(300),
  description: z.string().trim().min(20).max(2_000),
  logoUrl: optionalUrl.optional(),
  documentUrls: z.array(z.url()).min(1).max(5),
});

export type DealerApplicationInput = z.infer<typeof dealerApplicationSchema>;
