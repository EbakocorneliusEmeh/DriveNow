import { z } from "zod";

export const registerSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().trim().min(7).max(30),
  password: z.string().min(8).max(72),
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const verifyTokenSchema = z.object({
  token: z.string().length(64),
  type: z.enum(["email_verification", "phone_verification"]),
});

export const loginSchema = z.object({
  identifier: z.string().trim().min(3),
  password: z.string().min(1).max(72),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(40),
});

export const resetRequestSchema = z.object({
  identifier: z.string().trim().min(3),
});

export const resetPasswordSchema = z.object({
  token: z.string().length(64),
  password: z.string().min(8).max(72),
});

export type LoginInput = z.infer<typeof loginSchema>;
