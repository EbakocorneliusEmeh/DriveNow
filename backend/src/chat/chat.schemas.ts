import { z } from "zod";

export const chatIdSchema = z.string().uuid();

export const chatMessageSchema = z.object({
  conversationId: z.string().uuid(),
  body: z.string().trim().min(1).max(4_000),
});

export const chatReportSchema = z.object({
  reason: z.string().trim().min(10).max(1_000),
});
