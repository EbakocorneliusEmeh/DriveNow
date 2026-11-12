import { z } from "zod";

export const chatIdSchema = z.string().uuid();

export const chatMessageSchema = z.object({
  conversationId: z.string().uuid(),
  clientMessageId: z.string().uuid(),
  body: z.string().trim().min(1).max(2_000_000),
});

export const chatTypingSchema = z.object({
  conversationId: z.string().uuid(),
  isTyping: z.boolean(),
});

export const presenceVisibilitySchema = z.enum(["everyone", "contacts", "nobody"]);

export const chatReportSchema = z.object({
  reason: z.string().trim().min(10).max(1_000),
});
