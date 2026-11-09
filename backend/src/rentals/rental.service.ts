import { desc, eq, inArray } from "drizzle-orm";
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

export async function createRental(customerId: string, { vehicleId, startDate, endDate }: RentalInput) {
  const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.id, vehicleId));

  if (!vehicle) {
    throw new Error("Vehicle not found");
  }

  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const estimatedTotal = totalDays * vehicle.dailyRate;
  const startDateValue = startDate.toISOString().slice(0, 10);
  const endDateValue = endDate.toISOString().slice(0, 10);

  const [rental] = await db
    .insert(bookings)
    .values({
      customerId,
      vehicleId,
      startDate: startDateValue,
      endDate: endDateValue,
      totalDays,
      estimatedTotal,
      message: "",
      status: "pending",
    })
    .returning(rentalFields);

  return rental;
}

export async function getRental(rentalId: string) {
  const [booking] = await db.select(rentalFields).from(bookings).where(eq(bookings.id, rentalId));

  if (!booking) {
    return null;
  }

  const [vehicle] = await db
    .select({
      make: vehicles.make,
      model: vehicles.model,
      year: vehicles.year,
      dailyRate: vehicles.dailyRate,
      location: vehicles.location,
      imageUrls: vehicles.imageUrls,
    })
    .from(vehicles)
    .where(eq(vehicles.id, booking.vehicleId));

  const [customer] = await db
    .select({
      fullName: users.fullName,
      avatarUrl: users.avatarUrl,
    })
    .from(users)
    .where(eq(users.id, booking.customerId));

  return {
    ...booking,
    vehicle,
    customer,
  };
}

export async function getRentalsForVehicle(vehicleId: string) {
  const rows = await db
    .select(rentalFields)
    .from(bookings)
    .where(eq(bookings.vehicleId, vehicleId))
    .orderBy(desc(bookings.createdAt));

  if (rows.length === 0) {
    return [];
  }

  const customerIds = [...new Set(rows.map((row) => row.customerId))];
  const customerRows = await db
    .select({
      id: users.id,
      fullName: users.fullName,
      avatarUrl: users.avatarUrl,
    })
    .from(users)
    .where(inArray(users.id, customerIds));

  const customerMap = new Map(customerRows.map((customer) => [customer.id, customer]));

  return rows.map((row) => ({
    ...row,
    customer: customerMap.get(row.customerId) ?? null,
  }));
}

export async function getRentalsForCustomer(customerId: string) {
  const rows = await db
    .select(rentalFields)
    .from(bookings)
    .where(eq(bookings.customerId, customerId))
    .orderBy(desc(bookings.createdAt));

  if (rows.length === 0) {
    return [];
  }

  const vehicleIds = [...new Set(rows.map((row) => row.vehicleId))];
  const vehicleRows = await db
    .select({
      id: vehicles.id,
      make: vehicles.make,
      model: vehicles.model,
      year: vehicles.year,
      dailyRate: vehicles.dailyRate,
      location: vehicles.location,
      imageUrls: vehicles.imageUrls,
    })
    .from(vehicles)
    .where(inArray(vehicles.id, vehicleIds));

  const vehicleMap = new Map(vehicleRows.map((vehicle) => [vehicle.id, vehicle]));

  return rows.map((row) => ({
    ...row,
    vehicle: vehicleMap.get(row.vehicleId) ?? null,
  }));
}