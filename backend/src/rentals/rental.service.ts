import { and, desc, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { users, vehicles, bookings } from "../db/schema.js";
import type { RentalInput } from "./rental.schemas.js";

const rentalFields = {
  id: bookings.id,
  vehicleId: bookings.vehicleId,
  customerId: bookings.customerId,
  startDate: bookings.startDate,
  endDate: bookings.endDate,
  totalDays: bookings.totalDays,
  estimatedTotal: bookings.estimatedTotal,
  message: bookings.message,
  status: bookings.status,
  createdAt: bookings.createdAt,
  updatedAt: bookings.updatedAt,
};

export async function createRental(
  customerId: string,
  { vehicleId, startDate, endDate }: RentalInput
) {
  const vehicle = await db.query.vehicles.findFirst({
    where: eq(vehicles.id, vehicleId),
  });

  if (!vehicle) {
    throw new Error("Vehicle not found");
  }

  const totalDays = Math.ceil(
    (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  const estimatedTotal = totalDays * vehicle.dailyRate;

  const [rental] = await db
    .insert(bookings)
    .values({
      customerId,
      vehicleId,
      startDate,
      endDate,
      totalDays,
      estimatedTotal,
    })
    .returning(rentalFields);

  return rental;
}

export async function getRental(rentalId: string) {
  return db.query.bookings.findFirst({
    where: eq(bookings.id, rentalId),
    with: {
      vehicle: {
        columns: {
          make: true,
          model: true,
          year: true,
          dailyRate: true,
          location: true,
          imageUrls: true,
        },
      },
      customer: {
        columns: {
          fullName: true,
          avatarUrl: true,
        },
      },
    },
  });
}

export async function getRentalsForVehicle(vehicleId: string) {
  return db.query.bookings.findMany({
    where: eq(bookings.vehicleId, vehicleId),
    orderBy: [desc(bookings.createdAt)],
    with: {
      customer: {
        columns: {
          fullName: true,
          avatarUrl: true,
        },
      },
    },
  });
}

export async function getRentalsForCustomer(customerId: string) {
  return db.query.bookings.findMany({
    where: eq(bookings.customerId, customerId),
    orderBy: [desc(bookings.createdAt)],
    with: {
      vehicle: {
        columns: {
          make: true,
          model: true,
          year: true,
          dailyRate: true,
          location: true,
          imageUrls: true,
        },
      },
    },
  });
}