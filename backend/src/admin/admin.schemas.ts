import { z } from "zod";

export const reviewDealerApplicationSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
});
