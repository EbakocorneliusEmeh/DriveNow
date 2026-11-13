import { Router, type Router as ExpressRouter } from "express";
import { ZodError } from "zod";
import { requireAuth, requireRole, type AuthenticatedRequest } from "../auth/auth.middleware.js";
import { reviewDealerApplicationSchema, reviewVehicleSchema } from "./admin.schemas.js";
import { chatIdSchema } from "../chat/chat.schemas.js";
import { listReportedConversations, reviewReportedConversation } from "../chat/chat.service.js";
import { vehicleIdSchema } from "../dealers/vehicle.schemas.js";
import {
  getAdminDashboardStats,
  listDealerApplications,
  listVehicleReviews,
  listUsers,
  reviewDealerApplication,
  reviewVehicle,
} from "./admin.service.js";
import { createNotification } from "../notifications/notifications.service.js";

const router: ExpressRouter = Router();

router.use(requireAuth, requireRole("admin"));

router.get("/dashboard", async (_req, res) => {
  try {
    const [stats, applications, vehicleReviews, users] = await Promise.all([
      getAdminDashboardStats(),
      listDealerApplications(),
      listVehicleReviews(),
      listUsers(),
    ]);
    res.status(200).json({ success: true, data: { stats, applications, vehicleReviews, users } });
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
    const { decision, reason } = reviewDealerApplicationSchema.parse(req.body);
    const application = await reviewDealerApplication(req.params.applicationId, decision, reason);
    if (!application) {
      res.status(404).json({ success: false, message: "Pending dealer application not found." });
      return;
    }

    try {
      await createNotification({
        userId: application.userId,
        title: decision === "approved" ? "Dealer application approved" : "Dealer application update",
        body: decision === "approved"
          ? "Your dealer application was approved. You can now manage your business listings."
          : `Your dealer application needs changes: ${reason}`,
        link: "/become-a-dealer",
      });
    } catch (error) {
      console.error("Dealer application was reviewed, but notification delivery failed:", error);
    }

    res.status(200).json({
      success: true,
      message: `Dealer application ${decision}.`,
      data: { application },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ success: false, message: error.issues[0]?.message ?? "Choose whether to approve or reject the application." });
      return;
    }

    console.error(error);
    res.status(500).json({ success: false, message: "Unable to review dealer application" });
  }
});

router.patch("/vehicle-reviews/:vehicleId", async (req, res) => {
  const parsedId = vehicleIdSchema.safeParse(req.params.vehicleId);
  if (!parsedId.success) {
    res.status(400).json({ success: false, message: "Invalid vehicle listing." });
    return;
  }

  try {
    const { decision, reason } = reviewVehicleSchema.parse(req.body);
    const vehicle = await reviewVehicle(parsedId.data, decision, reason);
    if (!vehicle) {
      res.status(404).json({ success: false, message: "Pending vehicle review not found." });
      return;
    }

    if (vehicle.dealer) {
      try {
        await createNotification({
          userId: vehicle.dealer.userId,
          title: decision === "approved" ? "Vehicle listing approved" : "Vehicle listing needs changes",
          body: decision === "approved"
            ? `Your ${vehicle.year} ${vehicle.make} ${vehicle.model} listing is now published.`
            : `${vehicle.year} ${vehicle.make} ${vehicle.model}: ${reason}`,
          link: "/dashboard/dealer",
        });
      } catch (error) {
        console.error("Vehicle was reviewed, but notification delivery failed:", error);
      }
    }

    res.status(200).json({
      success: true,
      message: decision === "approved" ? "Vehicle listing approved and published." : "Vehicle listing rejected.",
      data: { vehicle },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ success: false, message: error.issues[0]?.message ?? "Choose a valid review decision." });
      return;
    }
    console.error(error);
    res.status(500).json({ success: false, message: "Unable to review vehicle listing." });
  }
});

export default router;
