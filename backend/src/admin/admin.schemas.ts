import { z } from "zod";

export const reviewDealerApplicationSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  reason: z.string().trim().min(5).max(1_000).optional(),
}).superRefine((input, context) => {
  if (input.decision === "rejected" && !input.reason) {
    context.addIssue({
      code: "custom",
      message: "Provide a reason when rejecting an application.",
      path: ["reason"],
    });
  }
});

export const reviewVehicleSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  reason: z.string().trim().min(5).max(1_000).optional(),
}).superRefine((input, context) => {
  if (input.decision === "rejected" && !input.reason) {
    context.addIssue({
      code: "custom",
      message: "Provide a reason when rejecting a listing.",
      path: ["reason"],
    });
  }
});
