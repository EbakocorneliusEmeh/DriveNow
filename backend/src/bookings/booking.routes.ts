import { Router, type Request, type Router as ExpressRouter } from "express";
import { ZodError } from "zod";
import { requireAuth, requireRole, type AuthenticatedRequest } from "../auth/auth.middleware.js";
import {
  bookingIdSchema,
  bookingCancellationSchema,
  bookingRequestSchema,
  bookingStatusSchema,
} from "./booking.schemas.js";
import {
  createBookingRequest,
  cancelBooking,
  listCustomerBookings,
  listDealerBookings,
  updateBookingStatus,
} from "./booking.service.js";

const router: ExpressRouter = Router();

function authenticatedUser(req: Request) {
  return (req as Request & AuthenticatedRequest).user;
}

router.use(requireAuth);

router.post("/", requireRole("customer"), async (req, res) => {
  try {
    const input = bookingRequestSchema.parse(req.body);
    const booking = await createBookingRequest({
      customerId: authenticatedUser(req).id,
      ...input,
    });
    res.status(201).json({
      success: true,
      message: "Your rental request has been sent to the dealer.",
      data: { booking },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({
        success: false,
        message: "Check your rental dates and try again.",
        errors: error.flatten().fieldErrors,
      });
      return;
    }
    if (error instanceof Error && error.name === "InvalidBookingDatesError") {
      res.status(400).json({ success: false, message: error.message });
      return;
    }
    if (error instanceof Error && error.name === "VehicleUnavailableError") {
      res.status(404).json({ success: false, message: error.message });
      return;
    }
    if (error instanceof Error && error.name === "BookingDateConflictError") {
      res.status(409).json({ success: false, message: error.message });
      return;
    }
    if (error instanceof Error && error.name === "VehicleAvailabilityBlockConflictError") {
      res.status(409).json({ success: false, message: error.message });
      return;
    }
    console.error(error);
    res.status(500).json({ success: false, message: "Unable to send your rental request." });
  }
});

router.get("/mine", requireRole("customer"), async (req, res) => {
  try {
    const bookings = await listCustomerBookings(authenticatedUser(req).id);
    res.status(200).json({ success: true, data: { bookings } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Unable to load your rental requests." });
  }
});

router.get("/dealer", requireRole("dealer"), async (req, res) => {
  try {
    const bookings = await listDealerBookings(authenticatedUser(req).id);
    res.status(200).json({ success: true, data: { bookings } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Unable to load booking requests." });
  }
});

router.patch("/:bookingId/cancel", requireRole("customer", "dealer"), async (req, res) => {
  try {
    const bookingId = bookingIdSchema.parse(req.params.bookingId);
    const { reason } = bookingCancellationSchema.parse(req.body ?? {});
    const user = authenticatedUser(req);
    if (user.role !== "customer" && user.role !== "dealer") {
      res.status(403).json({ success: false, message: "Only customers and dealers can cancel bookings." });
      return;
    }
    const booking = await cancelBooking(bookingId, user.id, user.role, reason);
    if (!booking) {
      res.status(404).json({
        success: false,
        message: "Active booking not found or you do not have permission to cancel it.",
      });
      return;
    }
    res.status(200).json({
      success: true,
      message: "The booking has been cancelled.",
      data: { booking },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ success: false, message: "Check the cancellation details and try again." });
      return;
    }
    console.error(error);
    res.status(500).json({ success: false, message: "Unable to cancel this booking." });
  }
});

router.patch("/:bookingId", requireRole("dealer"), async (req, res) => {
  try {
    const bookingId = bookingIdSchema.parse(req.params.bookingId);
    const { status } = bookingStatusSchema.parse(req.body);
    const booking = await updateBookingStatus(
      bookingId,
      authenticatedUser(req).id,
      status,
    );
    if (!booking) {
      res.status(404).json({
        success: false,
        message: "Pending booking request not found.",
      });
      return;
    }
    res.status(200).json({ success: true, data: { booking } });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ success: false, message: "Choose a valid booking status." });
      return;
    }
    console.error(error);
    res.status(500).json({ success: false, message: "Unable to update booking request." });
  }
});

export default router;
