import { Router, type Router as ExpressRouter } from "express";
import { ZodError } from "zod";
import { requireAuth, requireRole } from "../auth/auth.middleware.js";
import { reviewDealerApplicationSchema } from "./admin.schemas.js";
import {
  getAdminDashboardStats,
  listDealerApplications,
  listUsers,
  reviewDealerApplication,
} from "./admin.service.js";

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

router.patch("/dealer-applications/:applicationId", async (req, res) => {
  try {
    const { decision } = reviewDealerApplicationSchema.parse(req.body);
    const application = await reviewDealerApplication(req.params.applicationId, decision);
    if (!application) {
      res.status(404).json({ success: false, message: "Dealer application not found" });
      return;
    }

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
