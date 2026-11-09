import { and, desc, eq, gt, gte, lt, or } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  bookings,
  conversations,
  dealerProfiles,
  users,
  vehicles,
  vehicleAvailabilityBlocks,
} from "../db/schema.js";
import { createNotification } from "../notifications/notifications.service.js";

function daysBetween(startDate: string, endDate: string) {
  return Math.round(
    (Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86_400_000,
  );
}

export async function createBookingRequest(input: {
  customerId: string;
  vehicleId: string;
  startDate: string;
  endDate: string;
  message: string;
}) {
  const today = new Date().toISOString().slice(0, 10);
  if (input.startDate < today) {
    const error = new Error("Pickup date must be today or a future date.");
    error.name = "InvalidBookingDatesError";
    throw error;
  }

  const result = await db.transaction(async (tx) => {
    const [lockedVehicle] = await tx
      .select({ id: vehicles.id })
      .from(vehicles)
      .where(eq(vehicles.id, input.vehicleId))
      .for("update");

    const [vehicle] = lockedVehicle
      ? await tx
        .select({
          id: vehicles.id,
          dailyRate: vehicles.dailyRate,
          dealerUserId: dealerProfiles.userId,
          make: vehicles.make,
          model: vehicles.model,
          year: vehicles.year,
        })
        .from(vehicles)
        .innerJoin(dealerProfiles, eq(vehicles.dealerProfileId, dealerProfiles.id))
        .where(and(
          eq(vehicles.id, input.vehicleId),
          eq(vehicles.status, "published"),
          eq(dealerProfiles.approvalStatus, "approved"),
        ))
      : [];

    if (!vehicle) {
      const error = new Error("This vehicle is not available for booking.");
      error.name = "VehicleUnavailableError";
      throw error;
    }

    const [conflictingBooking] = await tx
      .select({ id: bookings.id })
      .from(bookings)
      .where(and(
        eq(bookings.vehicleId, vehicle.id),
        or(eq(bookings.status, "pending"), eq(bookings.status, "confirmed")),
        lt(bookings.startDate, input.endDate),
        gt(bookings.endDate, input.startDate),
      ))
      .limit(1);

    if (conflictingBooking) {
      const error = new Error("This car already has a booking request for some of those dates.");
      error.name = "BookingDateConflictError";
      throw error;
    }

    const [availabilityBlock] = await tx
      .select({ id: vehicleAvailabilityBlocks.id })
      .from(vehicleAvailabilityBlocks)
      .where(and(
        eq(vehicleAvailabilityBlocks.vehicleId, vehicle.id),
        lt(vehicleAvailabilityBlocks.startDate, input.endDate),
        gte(vehicleAvailabilityBlocks.endDate, input.startDate),
      ))
      .limit(1);

    if (availabilityBlock) {
      const error = new Error("The dealer marked some of these dates as unavailable.");
      error.name = "VehicleAvailabilityBlockConflictError";
      throw error;
    }

    const totalDays = daysBetween(input.startDate, input.endDate);
    const [booking] = await tx
      .insert(bookings)
      .values({
        vehicleId: vehicle.id,
        customerId: input.customerId,
        startDate: input.startDate,
        endDate: input.endDate,
        totalDays,
        estimatedTotal: totalDays * vehicle.dailyRate,
        message: input.message,
      })
      .returning({
        id: bookings.id,
        startDate: bookings.startDate,
        endDate: bookings.endDate,
        totalDays: bookings.totalDays,
        estimatedTotal: bookings.estimatedTotal,
        status: bookings.status,
      });

    return { booking, vehicle };
  });

  await createNotification({
    userId: result.vehicle.dealerUserId,
    title: "New vehicle rental request",
    body: `${result.vehicle.year} ${result.vehicle.make} ${result.vehicle.model}: ${input.startDate} to ${input.endDate}.`,
    link: "/dashboard/dealer#booking-requests",
  });

  return result.booking;
}

export async function listCustomerBookings(customerId: string) {
  return db
    .select({
      id: bookings.id,
      conversationId: conversations.id,
      vehicleId: bookings.vehicleId,
      make: vehicles.make,
      model: vehicles.model,
      year: vehicles.year,
      startDate: bookings.startDate,
      endDate: bookings.endDate,
      totalDays: bookings.totalDays,
      estimatedTotal: bookings.estimatedTotal,
      status: bookings.status,
      createdAt: bookings.createdAt,
      businessName: dealerProfiles.businessName,
    })
    .from(bookings)
    .innerJoin(vehicles, eq(bookings.vehicleId, vehicles.id))
    .innerJoin(dealerProfiles, eq(vehicles.dealerProfileId, dealerProfiles.id))
    .leftJoin(conversations, eq(conversations.bookingId, bookings.id))
    .where(eq(bookings.customerId, customerId))
    .orderBy(desc(bookings.createdAt));
}

export async function listDealerBookings(dealerUserId: string) {
  return db
    .select({
      id: bookings.id,
      conversationId: conversations.id,
      vehicleId: bookings.vehicleId,
      make: vehicles.make,
      model: vehicles.model,
      year: vehicles.year,
      startDate: bookings.startDate,
      endDate: bookings.endDate,
      totalDays: bookings.totalDays,
      estimatedTotal: bookings.estimatedTotal,
      message: bookings.message,
      status: bookings.status,
      createdAt: bookings.createdAt,
      customerName: users.fullName,
      customerEmail: users.email,
      customerPhone: users.phone,
    })
    .from(bookings)
    .innerJoin(vehicles, eq(bookings.vehicleId, vehicles.id))
    .innerJoin(dealerProfiles, eq(vehicles.dealerProfileId, dealerProfiles.id))
    .innerJoin(users, eq(bookings.customerId, users.id))
    .leftJoin(conversations, eq(conversations.bookingId, bookings.id))
    .where(eq(dealerProfiles.userId, dealerUserId))
    .orderBy(desc(bookings.createdAt));
}

export async function updateBookingStatus(
  bookingId: string,
  dealerUserId: string,
  status: "confirmed" | "declined",
) {
  const booking = await db.transaction(async (tx) => {
    const [ownedBooking] = await tx
      .select({ id: bookings.id })
      .from(bookings)
      .innerJoin(vehicles, eq(bookings.vehicleId, vehicles.id))
      .innerJoin(dealerProfiles, eq(vehicles.dealerProfileId, dealerProfiles.id))
      .where(and(
        eq(bookings.id, bookingId),
        eq(dealerProfiles.userId, dealerUserId),
        eq(bookings.status, "pending"),
      ))
      .for("update");

    if (!ownedBooking) return undefined;

    const [updatedBooking] = await tx
      .update(bookings)
      .set({ status, updatedAt: new Date() })
      .where(and(
        eq(bookings.id, ownedBooking.id),
        eq(bookings.status, "pending"),
      ))
      .returning({
        id: bookings.id,
        customerId: bookings.customerId,
        status: bookings.status,
        vehicleId: bookings.vehicleId,
      });

    if (updatedBooking && status === "confirmed") {
      await tx
        .insert(conversations)
        .values({ bookingId: updatedBooking.id })
        .onConflictDoNothing({ target: conversations.bookingId });
    }

    return updatedBooking;
  });

  if (!booking) return undefined;

  await createNotification({
    userId: booking.customerId,
    title: status === "confirmed" ? "Rental request confirmed" : "Rental request declined",
    body: status === "confirmed"
      ? "The dealer confirmed your rental request."
      : "The dealer could not accept your rental request.",
    link: "/dashboard/bookings",
  });

  return booking;
}

export async function cancelBooking(
  bookingId: string,
  userId: string,
  role: "customer" | "dealer",
  reason: string,
) {
  const cancellation = await db.transaction(async (tx) => {
    const [lockedBooking] = await tx
      .select({
        id: bookings.id,
        customerId: bookings.customerId,
        status: bookings.status,
        vehicleId: bookings.vehicleId,
      })
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .for("update");

    if (!lockedBooking || !["pending", "confirmed"].includes(lockedBooking.status)) {
      return undefined;
    }

    const [vehicle] = await tx
      .select({
        dealerUserId: dealerProfiles.userId,
        make: vehicles.make,
        model: vehicles.model,
        year: vehicles.year,
      })
      .from(vehicles)
      .innerJoin(dealerProfiles, eq(vehicles.dealerProfileId, dealerProfiles.id))
      .where(eq(vehicles.id, lockedBooking.vehicleId));

    if (!vehicle) return undefined;

    const isCustomer = role === "customer" && lockedBooking.customerId === userId;
    const isDealer = role === "dealer" && vehicle.dealerUserId === userId;
    if (!isCustomer && !isDealer) return undefined;

    const [updatedBooking] = await tx
      .update(bookings)
      .set({
        status: "cancelled",
        cancelledById: userId,
        updatedAt: new Date(),
      })
      .where(and(
        eq(bookings.id, bookingId),
        or(eq(bookings.status, "pending"), eq(bookings.status, "confirmed")),
      ))
      .returning({ id: bookings.id, status: bookings.status });

    if (!updatedBooking) return undefined;

    return {
      booking: updatedBooking,
      recipientId: isCustomer ? vehicle.dealerUserId : lockedBooking.customerId,
      vehicleName: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
      cancelledBy: isCustomer ? "customer" : "dealer",
    };
  });

  if (!cancellation) return undefined;

  try {
    await createNotification({
      userId: cancellation.recipientId,
      title: "Rental booking cancelled",
      body: `${cancellation.vehicleName} booking was cancelled by the ${cancellation.cancelledBy}.${reason ? ` Reason: ${reason}` : ""}`,
      link: role === "customer" ? "/dashboard/dealer#booking-requests" : "/dashboard/bookings",
    });
  } catch (error) {
    console.error("Booking was cancelled, but the other party could not be notified:", error);
  }

  return cancellation.booking;
}
