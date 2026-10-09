import { Router, type Router as ExpressRouter } from "express";
import { ZodError } from "zod";
import {
  loginSchema,
  refreshSchema,
  registerSchema,
  resetPasswordSchema,
  resetRequestSchema,
  verifyTokenSchema,
} from "./auth.schemas.js";
import {
  getUserProfile,
  loginUser,
  logoutUser,
  refreshUserSession,
  registerUser,
  requestPasswordReset,
  resetUserPassword,
  verifyUserContact,
} from "./auth.service.js";
import { requireAuth, type AuthenticatedRequest } from "./auth.middleware.js";

const router: ExpressRouter = Router();

router.post("/register", async (req, res) => {
  try {
    const input = registerSchema.parse(req.body);
    const result = await registerUser(input);

    res.status(201).json({
      success: true,
      message: "Account created. Verify your email before logging in.",
      data: result,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({
        success: false,
        message: "Invalid registration details",
        errors: error.flatten().fieldErrors,
      });
      return;
    }

    if (error instanceof Error && error.name === "ConflictError") {
      res.status(409).json({ success: false, message: error.message });
      return;
    }

    console.error(error);
    res.status(500).json({ success: false, message: "Unable to create account" });
  }
});

router.post("/verify", async (req, res) => {
  try {
    const { token, type } = verifyTokenSchema.parse(req.body);
    await verifyUserContact(token, type);

    res.status(200).json({
      success: true,
      message: `${type === "email_verification" ? "Email" : "Phone number"} verified successfully`,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ success: false, message: "Invalid verification details" });
      return;
    }

    if (error instanceof Error && error.name === "InvalidTokenError") {
      res.status(400).json({ success: false, message: error.message });
      return;
    }

    console.error(error);
    res.status(500).json({ success: false, message: "Unable to verify contact" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const result = await loginUser(loginSchema.parse(req.body));
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ success: false, message: "Invalid login details" });
      return;
    }
    if (error instanceof Error && error.name === "InvalidCredentialsError") {
      res.status(401).json({ success: false, message: error.message });
      return;
    }
    if (error instanceof Error && error.name === "UnverifiedUserError") {
      res.status(403).json({ success: false, message: error.message });
      return;
    }
    console.error(error);
    res.status(500).json({ success: false, message: "Unable to log in" });
  }
});

router.post("/refresh", async (req, res) => {
  try {
    const { refreshToken } = refreshSchema.parse(req.body);
    const result = await refreshUserSession(refreshToken);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    if (error instanceof ZodError || (error instanceof Error && error.name === "InvalidTokenError")) {
      res.status(401).json({ success: false, message: "Invalid or expired refresh token" });
      return;
    }
    console.error(error);
    res.status(500).json({ success: false, message: "Unable to refresh session" });
  }
});

router.post("/logout", async (req, res) => {
  try {
    const { refreshToken } = refreshSchema.parse(req.body);
    await logoutUser(refreshToken);
    res.status(204).send();
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ success: false, message: "Refresh token is required" });
      return;
    }
    console.error(error);
    res.status(500).json({ success: false, message: "Unable to log out" });
  }
});

router.get("/me", requireAuth, async (req, res) => {
  const user = await getUserProfile((req as AuthenticatedRequest).user.id);
  if (!user) {
    res.status(404).json({ success: false, message: "User account not found" });
    return;
  }
  res.status(200).json({ success: true, data: { user } });
});

router.post("/forgot-password", async (req, res) => {
  try {
    const { identifier } = resetRequestSchema.parse(req.body);
    const resetToken = await requestPasswordReset(identifier);
    res.status(200).json({
      success: true,
      message: "If an account exists, password reset instructions have been sent",
      ...(process.env.NODE_ENV === "production" ? {} : { resetToken }),
    });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ success: false, message: "Email or phone number is required" });
      return;
    }
    console.error(error);
    res.status(500).json({ success: false, message: "Unable to request password reset" });
  }
});

router.post("/reset-password", async (req, res) => {
  try {
    const { token, password } = resetPasswordSchema.parse(req.body);
    await resetUserPassword(token, password);
    res.status(200).json({ success: true, message: "Password reset successfully" });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ success: false, message: "Invalid password reset details" });
      return;
    }
    if (error instanceof Error && error.name === "InvalidTokenError") {
      res.status(400).json({ success: false, message: error.message });
      return;
    }
    console.error(error);
    res.status(500).json({ success: false, message: "Unable to reset password" });
  }
});

export default router;
