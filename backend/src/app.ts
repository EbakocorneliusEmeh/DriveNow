import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import adminRoutes from "./admin/admin.routes.js";
import authRoutes from "./auth/auth.routes.js";
import bookingRoutes from "./bookings/booking.routes.js";
import chatRoutes from "./chat/chat.routes.js";
import dealerRoutes from "./dealers/dealer.routes.js";
import vehicleRoutes from "./dealers/vehicle.routes.js";
import notificationRoutes from "./notifications/notifications.routes.js";

const app: Express = express();

// Security
app.use(helmet());

// Allow frontend to communicate with backend
app.use(
  cors({
    origin: process.env.FRONTEND_URL ?? "http://localhost:3000",
    credentials: true,
  })
);

// Parse JSON requests
app.use(express.json());

// Parse URL-encoded requests
app.use(express.urlencoded({ extended: true }));

// HTTP request logging
app.use(morgan("dev"));

app.use("/api/auth", authRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/dealers", dealerRoutes);
app.use("/api/vehicles", vehicleRoutes);
app.use("/api/notifications", notificationRoutes);

// Health check
app.get("/api/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "DriveNow backend is running",
  });
});

export default app;
