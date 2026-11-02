import { Router, type Router as ExpressRouter } from "express";
import { ZodError, z } from "zod";
import { requireAuth, type AuthenticatedRequest } from "../auth/auth.middleware.js";
import {
  listNotifications,
  markNotificationRead,
  registerInstallation,
} from "./notifications.service.js";

const router: ExpressRouter = Router();
const installationSchema = z.object({ installationId: z.string().min(10).max(512) });

router.use(requireAuth);

router.get("/", async (req, res) => {
  try {
    const userId = (req as AuthenticatedRequest).user.id;
    const items = await listNotifications(userId);
    res.status(200).json({ success: true, data: { notifications: items } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Unable to load notifications" });
  }
});

router.post("/installation", async (req, res) => {
  try {
    const { installationId } = installationSchema.parse(req.body);
    await registerInstallation((req as AuthenticatedRequest).user.id, installationId);
    res.status(200).json({ success: true, message: "This browser is registered for notifications." });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ success: false, message: "A valid Firebase installation ID is required." });
      return;
    }
    console.error(error);
    res.status(500).json({ success: false, message: "Unable to register this browser for notifications" });
  }
});

router.patch("/:notificationId/read", async (req, res) => {
  try {
    const result = await markNotificationRead(
      (req as unknown as AuthenticatedRequest).user.id,
      req.params.notificationId,
    );
    res.status(200).json({ success: true, data: { updated: Boolean(result) } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Unable to update notification" });
  }
});

export default router;
