import { Router, type Router as ExpressRouter } from "express";
import { ZodError } from "zod";
import { requireAuth, type AuthenticatedRequest } from "../auth/auth.middleware.js";
import { dealerApplicationSchema } from "./dealer.schemas.js";
import { getDealerProfile, submitDealerApplication } from "./dealer.service.js";

const router: ExpressRouter = Router();

router.use(requireAuth);

router.get("/me", async (req, res) => {
  try {
    const profile = await getDealerProfile((req as AuthenticatedRequest).user.id);
    res.status(200).json({ success: true, data: { profile: profile ?? null } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Unable to load dealer profile" });
  }
});

router.post("/application", async (req, res) => {
  try {
    const input = dealerApplicationSchema.parse(req.body);
    const profile = await submitDealerApplication(
      (req as AuthenticatedRequest).user.id,
      input,
    );
    res.status(201).json({
      success: true,
      message: "Your dealer application has been submitted for review.",
      data: { profile },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({
        success: false,
        message: "Please check your business details and document links.",
        errors: error.flatten().fieldErrors,
      });
      return;
    }

    console.error(error);
    res.status(500).json({ success: false, message: "Unable to submit dealer application" });
  }
});

export default router;
