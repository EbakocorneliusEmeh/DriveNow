import { Router, type Request, type Router as ExpressRouter } from "express";
import { ZodError } from "zod";
import { requireAuth, requireRole, type AuthenticatedRequest } from "../auth/auth.middleware.js";
import { chatIdSchema, chatReportSchema, presenceVisibilitySchema } from "./chat.schemas.js";
import {
  getPresenceSettings,
  getBookingConversationForParticipant,
  listUserConversations,
  reportConversation,
  updatePresenceVisibility,
} from "./chat.service.js";
import { publishUserPresence } from "./chat.socket.js";

const router: ExpressRouter = Router();

function authenticatedUser(req: Request) {
  return (req as Request & AuthenticatedRequest).user;
}

router.use(requireAuth, requireRole("customer", "dealer"));

router.get("/", async (req, res) => {
  try {
    const user = authenticatedUser(req);
    if (user.role !== "customer" && user.role !== "dealer") {
      res.status(403).json({ success: false, message: "Only customers and dealers can use booking chat." });
      return;
    }
    const conversations = await listUserConversations(user.id, user.role);
    res.status(200).json({ success: true, data: { conversations } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Unable to load your conversations." });
  }
});

router.get("/presence", async (req, res) => {
  try {
    const settings = await getPresenceSettings(authenticatedUser(req).id);
    if (!settings) {
      res.status(404).json({ success: false, message: "Presence settings not found." });
      return;
    }
    res.status(200).json({ success: true, data: settings });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Unable to load presence settings." });
  }
});

router.patch("/presence", async (req, res) => {
  const parsed = presenceVisibilitySchema.safeParse(req.body?.visibility);
  if (!parsed.success) {
    res.status(400).json({ success: false, message: "Choose everyone, contacts, or nobody." });
    return;
  }

  try {
    const settings = await updatePresenceVisibility(authenticatedUser(req).id, parsed.data);
    if (!settings) {
      res.status(404).json({ success: false, message: "Presence settings not found." });
      return;
    }
    await publishUserPresence(authenticatedUser(req).id);
    res.status(200).json({ success: true, data: settings });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Unable to update presence settings." });
  }
});

router.get("/bookings/:bookingId", async (req, res) => {
  const parsedBookingId = chatIdSchema.safeParse(req.params.bookingId);
  if (!parsedBookingId.success) {
    res.status(400).json({ success: false, message: "Invalid booking." });
    return;
  }

  try {
    const user = authenticatedUser(req);
    if (user.role !== "customer" && user.role !== "dealer") {
      res.status(403).json({ success: false, message: "Only customers and dealers can use booking chat." });
      return;
    }
    const conversation = await getBookingConversationForParticipant(
      parsedBookingId.data,
      user.id,
      user.role,
    );
    if (!conversation) {
      res.status(404).json({
        success: false,
        message: "Chat is available only to the customer and dealer after the booking is approved.",
      });
      return;
    }
    res.status(200).json({ success: true, data: { conversation } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Unable to load this conversation." });
  }
});

router.post("/:conversationId/report", async (req, res) => {
  try {
    const conversationId = chatIdSchema.parse(req.params.conversationId);
    const { reason } = chatReportSchema.parse(req.body);
    const user = authenticatedUser(req);
    if (user.role !== "customer" && user.role !== "dealer") {
      res.status(403).json({ success: false, message: "Only conversation participants can report a chat." });
      return;
    }

    const report = await reportConversation(conversationId, user.id, user.role, reason);
    if (!report) {
      res.status(404).json({ success: false, message: "Conversation not found." });
      return;
    }
    res.status(200).json({
      success: true,
      message: report.alreadyReported
        ? "This conversation has already been reported for review."
        : "Your report was sent to DriveNow support.",
      data: report,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({
        success: false,
        message: "Please describe the issue in at least 10 characters.",
      });
      return;
    }
    console.error(error);
    res.status(500).json({ success: false, message: "Unable to report this conversation." });
  }
});

export default router;
