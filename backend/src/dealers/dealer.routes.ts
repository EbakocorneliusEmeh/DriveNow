import express from "express";
import { Router, type Request, type Response, type Router as ExpressRouter } from "express";
import { ZodError } from "zod";
import { requireAuth, requireRole, type AuthenticatedRequest } from "../auth/auth.middleware.js";
import { dealerApplicationSchema, dealerProfileUpdateSchema } from "./dealer.schemas.js";
import {
  getDealerProfile,
  submitDealerApplication,
  updateDealerLogo,
  updateDealerProfile,
  updateDealerProfilePicture,
} from "./dealer.service.js";
import { notifyAdmins } from "../notifications/notifications.service.js";

const router: ExpressRouter = Router();

function uploadDealerImage(
  upload: typeof updateDealerLogo,
  failureMessage: string,
) {
  return async (req: Request, res: Response) => {
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      res.status(400).json({ success: false, message: "Choose an image to upload" });
      return;
    }

    try {
      const profile = await upload(
        (req as AuthenticatedRequest).user.id,
        req.header("content-type") ?? "",
        req.body,
      );
      res.status(200).json({ success: true, data: { profile } });
    } catch (error) {
      if (error instanceof Error && error.name === "InvalidDealerImageError") {
        res.status(400).json({ success: false, message: error.message });
        return;
      }
      if (error instanceof Error && error.name === "DealerProfileNotFoundError") {
        res.status(404).json({ success: false, message: error.message });
        return;
      }
      if (error instanceof Error && error.name === "CloudinaryConfigError") {
        res.status(503).json({ success: false, message: error.message });
        return;
      }
      if (error instanceof Error && error.name === "CloudinaryUploadError") {
        res.status(502).json({ success: false, message: error.message });
        return;
      }
      console.error(error);
      res.status(500).json({ success: false, message: failureMessage });
    }
  };
}

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

router.patch("/me", requireRole("dealer"), async (req, res) => {
  try {
    const input = dealerProfileUpdateSchema.parse(req.body);
    const profile = await updateDealerProfile(
      (req as AuthenticatedRequest).user.id,
      input,
    );
    if (!profile) {
      res.status(404).json({ success: false, message: "Dealer business profile not found" });
      return;
    }
    res.status(200).json({ success: true, data: { profile } });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({
        success: false,
        message: "Please check your business details.",
        errors: error.flatten().fieldErrors,
      });
      return;
    }

    console.error(error);
    res.status(500).json({ success: false, message: "Unable to update your business profile" });
  }
});

router.post(
  "/me/logo",
  requireRole("dealer"),
  express.raw({ type: ["image/jpeg", "image/png", "image/webp"], limit: "5mb" }),
  uploadDealerImage(updateDealerLogo, "Unable to upload your business logo"),
);

router.post(
  "/me/profile-picture",
  requireRole("dealer"),
  express.raw({ type: ["image/jpeg", "image/png", "image/webp"], limit: "5mb" }),
  uploadDealerImage(updateDealerProfilePicture, "Unable to upload your profile picture"),
);

router.post("/application", async (req, res) => {
  try {
    const input = dealerApplicationSchema.parse(req.body);
    const profile = await submitDealerApplication(
      (req as AuthenticatedRequest).user.id,
      input,
    );
    await notifyAdmins({
      title: "Dealer application submitted",
      body: `${profile.businessName} is waiting for review.`,
      link: "/admin",
    });
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
