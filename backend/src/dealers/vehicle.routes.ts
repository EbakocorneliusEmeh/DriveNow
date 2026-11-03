import express from "express";
import { Router, type Request, type Router as ExpressRouter } from "express";
import { ZodError } from "zod";
import { requireAuth, requireRole, type AuthenticatedRequest } from "../auth/auth.middleware.js";
import {
  addVehicleImage,
  createVehicle,
  deleteVehicle,
  getPublishedVehicle,
  listDealerVehicles,
  listPublishedVehicles,
  setVehicleStatus,
  updateVehicle,
} from "./vehicle.service.js";
import { vehicleIdSchema, vehicleInputSchema, vehicleStatusSchema } from "./vehicle.schemas.js";

const router: ExpressRouter = Router();

function authenticatedUserId(req: Request) {
  return (req as Request & AuthenticatedRequest).user.id;
}

router.get("/", async (_req, res) => {
  try {
    const vehicles = await listPublishedVehicles();
    res.status(200).json({ success: true, data: { vehicles } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Unable to load vehicle listings." });
  }
});

router.get("/public/:vehicleId", async (req, res) => {
  const parsedVehicleId = vehicleIdSchema.safeParse(req.params.vehicleId);
  if (!parsedVehicleId.success) {
    res.status(400).json({ success: false, message: "Invalid vehicle listing." });
    return;
  }

  try {
    const vehicle = await getPublishedVehicle(parsedVehicleId.data);
    if (!vehicle) {
      res.status(404).json({ success: false, message: "Vehicle listing not found." });
      return;
    }
    res.status(200).json({ success: true, data: { vehicle } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Unable to load vehicle listing." });
  }
});

router.use(requireAuth, requireRole("dealer"));

router.get("/mine", async (req, res) => {
  try {
    const vehicles = await listDealerVehicles(authenticatedUserId(req));
    res.status(200).json({ success: true, data: { vehicles } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Unable to load your vehicle inventory." });
  }
});

router.post("/", async (req, res) => {
  try {
    const input = vehicleInputSchema.parse(req.body);
    const vehicle = await createVehicle(authenticatedUserId(req), input);
    res.status(201).json({ success: true, data: { vehicle } });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ success: false, message: "Check the vehicle details and try again." });
      return;
    }
    if (error instanceof Error && error.name === "DealerProfileNotFoundError") {
      res.status(409).json({ success: false, message: error.message });
      return;
    }
    console.error(error);
    res.status(500).json({ success: false, message: "Unable to create vehicle listing." });
  }
});

router.post(
  "/:vehicleId/images",
  express.raw({ type: ["image/jpeg", "image/png", "image/webp"], limit: "5mb" }),
  async (req, res) => {
    const parsedVehicleId = vehicleIdSchema.safeParse(req.params.vehicleId);
    if (!parsedVehicleId.success) {
      res.status(400).json({ success: false, message: "Invalid vehicle listing." });
      return;
    }
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      res.status(400).json({ success: false, message: "Choose a photo to upload." });
      return;
    }

    try {
      const vehicle = await addVehicleImage(
        authenticatedUserId(req),
        parsedVehicleId.data,
        req.header("content-type") ?? "",
        req.body,
      );
      res.status(200).json({ success: true, data: { vehicle } });
    } catch (error) {
      if (error instanceof Error && error.name === "InvalidVehicleImageError") {
        res.status(400).json({ success: false, message: error.message });
        return;
      }
      if (error instanceof Error && error.name === "VehicleNotFoundError") {
        res.status(404).json({ success: false, message: error.message });
        return;
      }
      if (error instanceof Error && error.name === "VehicleImageLimitError") {
        res.status(400).json({ success: false, message: error.message });
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
      res.status(500).json({ success: false, message: "Unable to upload vehicle photo." });
    }
  },
);

router.patch("/:vehicleId", async (req, res) => {
  try {
    const vehicleId = vehicleIdSchema.parse(req.params.vehicleId);
    const input = vehicleInputSchema.parse(req.body);
    const vehicle = await updateVehicle(authenticatedUserId(req), vehicleId, input);
    if (!vehicle) {
      res.status(404).json({ success: false, message: "Vehicle listing not found." });
      return;
    }
    res.status(200).json({ success: true, data: { vehicle } });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ success: false, message: "Check the vehicle details and try again." });
      return;
    }
    console.error(error);
    res.status(500).json({ success: false, message: "Unable to update vehicle listing." });
  }
});

router.patch("/:vehicleId/status", async (req, res) => {
  try {
    const vehicleId = vehicleIdSchema.parse(req.params.vehicleId);
    const { status } = vehicleStatusSchema.parse(req.body);
    const vehicle = await setVehicleStatus(authenticatedUserId(req), vehicleId, status);
    if (!vehicle) {
      res.status(404).json({ success: false, message: "Vehicle listing not found." });
      return;
    }
    res.status(200).json({ success: true, data: { vehicle } });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ success: false, message: "Choose a valid listing status." });
      return;
    }
    if (error instanceof Error && error.name === "DealerNotApprovedError") {
      res.status(403).json({ success: false, message: error.message });
      return;
    }
    if (error instanceof Error && error.name === "DealerProfileNotFoundError") {
      res.status(409).json({ success: false, message: error.message });
      return;
    }
    console.error(error);
    res.status(500).json({ success: false, message: "Unable to change vehicle listing status." });
  }
});

router.delete("/:vehicleId", async (req, res) => {
  try {
    const vehicleId = vehicleIdSchema.parse(req.params.vehicleId);
    const vehicle = await deleteVehicle(authenticatedUserId(req), vehicleId);
    if (!vehicle) {
      res.status(404).json({ success: false, message: "Vehicle listing not found." });
      return;
    }
    res.status(200).json({ success: true, message: "Vehicle listing deleted." });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ success: false, message: "Invalid vehicle listing." });
      return;
    }
    console.error(error);
    res.status(500).json({ success: false, message: "Unable to delete vehicle listing." });
  }
});

export default router;
