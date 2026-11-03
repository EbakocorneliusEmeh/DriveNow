import { Router, type Router as ExpressRouter } from "express";
import { ZodError } from "zod";
import { requireAuth, requireRole, type AuthenticatedRequest } from "../auth/auth.middleware.js";
import { reviewDealerApplicationSchema } from "./admin.schemas.js";
import { chatIdSchema } from "../chat/chat.schemas.js";
import { listReportedConversations, reviewReportedConversation } from "../chat/chat.service.js";
import {
  getAdminDashboardStats,
  listDealerApplications,
  listUsers,
  reviewDealerApplication,
} from "./admin.service.js";
import { createNotification } from "../notifications/notifications.service.js";

const router: ExpressRouter = Router();

router.use(requireAuth, requireRole("admin"));

router.get("/dashboard", async (_req, res) => {
  try {
    const [stats, applications, users] = await Promise.all([
      getAdminDashboardStats(),
      listDealerApplications(),
      listUsers(),
    ]);
    res.status(200).json({ success: true, data: { stats, applications, users } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Unable to load the admin dashboard" });
  }
});

router.get("/chat-reports", async (_req, res) => {
  try {
    const reports = await listReportedConversations();
    res.status(200).json({ success: true, data: { reports } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Unable to load reported chats." });
  }
});

router.get("/chat-reports/:conversationId", async (req, res) => {
  const parsedId = chatIdSchema.safeParse(req.params.conversationId);
  if (!parsedId.success) {
    res.status(400).json({ success: false, message: "Invalid reported conversation." });
    return;
  }

  try {
    const adminId = (req as unknown as AuthenticatedRequest).user.id;
    const conversation = await reviewReportedConversation(parsedId.data, adminId);
    if (!conversation) {
      res.status(404).json({ success: false, message: "Reported conversation not found." });
      return;
    }
    res.status(200).json({ success: true, data: { conversation } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Unable to review reported chat." });
  }
});

router.patch("/dealer-applications/:applicationId", async (req, res) => {
  try {
    const { decision } = reviewDealerApplicationSchema.parse(req.body);
    const application = await reviewDealerApplication(req.params.applicationId, decision);
    if (!application) {
      res.status(404).json({ success: false, message: "Dealer application not found" });
      return;
    }

    await createNotification({
      userId: application.userId,
      title: decision === "approved" ? "Dealer application approved" : "Dealer application update",
      body: decision === "approved"
        ? "Your dealer application was approved. You can now manage your business listings."
        : "Your dealer application was not approved. Review your application details and contact support if you need help.",
      link: "/become-a-dealer",
    });

    res.status(200).json({
      success: true,
      message: `Dealer application ${decision}.`,
      data: { application },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ success: false, message: "Choose whether to approve or reject the application" });
      return;
    }

    console.error(error);
    res.status(500).json({ success: false, message: "Unable to review dealer application" });
  }
});

export default router;
