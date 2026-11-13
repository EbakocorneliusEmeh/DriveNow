import { createHash, randomUUID } from "node:crypto";
import { and, asc, desc, eq, gte, gt, ilike, inArray, lt, lte, notExists, or, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { bookings, dealerProfiles, vehicles, vehicleAvailabilityBlocks } from "../db/schema.js";
import type { AvailabilityBlockInput, VehicleInput, VehicleSearch } from "./vehicle.schemas.js";

export async function searchVehicles(input: VehicleSearch) {
  const conditions = [
    eq(vehicles.status, "published"),
    eq(vehicles.approvalStatus, "approved"),
    eq(dealerProfiles.approvalStatus, "approved"),
  ];

  if (input.priceRange) {
    conditions.push(gte(vehicles.dailyRate, input.priceRange[0]));
    conditions.push(lte(vehicles.dailyRate, input.priceRange[1]));
  }
  const searchTerms = input.query?.split(/\s+/).filter(Boolean) ?? [];
  for (const term of searchTerms) {
    const pattern = `%${term.replace(/[\\%_]/g, "\\$&")}%`;
    const textMatch = or(
      ilike(vehicles.make, pattern),
      ilike(vehicles.model, pattern),
      ilike(vehicles.location, pattern),
      ilike(vehicles.description, pattern),
      ilike(dealerProfiles.businessName, pattern),
      sql`${vehicles.vehicleType}::text ILIKE ${pattern}`,
      sql`${vehicles.transmission}::text ILIKE ${pattern}`,
      sql`${vehicles.fuelType}::text ILIKE ${pattern}`,
      sql`${vehicles.year}::text ILIKE ${pattern}`,
      sql`${vehicles.dailyRate}::text ILIKE ${pattern}`,
      sql`${vehicles.seatingCapacity}::text ILIKE ${pattern}`,
    );
    if (textMatch) conditions.push(textMatch);
  }
  if (input.pickupDate && input.returnDate) {
    conditions.push(
      notExists(
        db
          .select({ id: bookings.id })
          .from(bookings)
          .where(and(
            eq(bookings.vehicleId, vehicles.id),
            inArray(bookings.status, ["pending", "confirmed"]),
            lt(bookings.startDate, input.returnDate),
            gt(bookings.endDate, input.pickupDate),
          )),
      ),
    );
    conditions.push(
      notExists(
        db
          .select({ id: vehicleAvailabilityBlocks.id })
          .from(vehicleAvailabilityBlocks)
          .where(and(
            eq(vehicleAvailabilityBlocks.vehicleId, vehicles.id),
            lt(vehicleAvailabilityBlocks.startDate, input.returnDate),
            gte(vehicleAvailabilityBlocks.endDate, input.pickupDate),
          )),
      ),
    );
  }
  if (input.vehicleType) {
    conditions.push(eq(vehicles.vehicleType, input.vehicleType));
  }
  if (input.transmission) {
    conditions.push(eq(vehicles.transmission, input.transmission));
  }
  if (input.fuelType) {
    conditions.push(eq(vehicles.fuelType, input.fuelType));
  }
  if (input.seatingCapacity) {
    conditions.push(gte(vehicles.seatingCapacity, input.seatingCapacity));
  }

  return db
    .select({
      ...vehicleFields,
      businessName: dealerProfiles.businessName,
      businessPhone: dealerProfiles.businessPhone,
    })
    .from(vehicles)
    .innerJoin(dealerProfiles, eq(vehicles.dealerProfileId, dealerProfiles.id))
    .where(and(...conditions))
    .orderBy(desc(vehicles.createdAt));
}

export async function listVehicleAvailabilityBlocks(userId: string, vehicleId: string) {
  const [vehicle] = await db
    .select({ id: vehicles.id })
    .from(vehicles)
    .innerJoin(dealerProfiles, eq(vehicles.dealerProfileId, dealerProfiles.id))
    .where(and(eq(vehicles.id, vehicleId), eq(dealerProfiles.userId, userId)));

  if (!vehicle) return undefined;

  return db
    .select({
      id: vehicleAvailabilityBlocks.id,
      startDate: vehicleAvailabilityBlocks.startDate,
      endDate: vehicleAvailabilityBlocks.endDate,
    })
    .from(vehicleAvailabilityBlocks)
    .where(eq(vehicleAvailabilityBlocks.vehicleId, vehicleId))
    .orderBy(asc(vehicleAvailabilityBlocks.startDate));
}

export async function addVehicleAvailabilityBlock(
  userId: string,
  vehicleId: string,
  input: AvailabilityBlockInput,
) {
  return db.transaction(async (tx) => {
    const [lockedVehicle] = await tx
      .select({ id: vehicles.id })
      .from(vehicles)
      .where(eq(vehicles.id, vehicleId))
      .for("update");

    if (!lockedVehicle) return undefined;

    const [ownedVehicle] = await tx
      .select({ id: vehicles.id })
      .from(vehicles)
      .innerJoin(dealerProfiles, eq(vehicles.dealerProfileId, dealerProfiles.id))
      .where(and(eq(vehicles.id, vehicleId), eq(dealerProfiles.userId, userId)));

    if (!ownedVehicle) return undefined;

    const [conflictingBooking] = await tx
      .select({ id: bookings.id })
      .from(bookings)
      .where(and(
        eq(bookings.vehicleId, vehicleId),
        inArray(bookings.status, ["pending", "confirmed"]),
        lte(bookings.startDate, input.endDate),
        gt(bookings.endDate, input.startDate),
      ))
      .limit(1);

    if (conflictingBooking) {
      const error = new Error("These dates overlap with a pending or confirmed booking.");
      error.name = "AvailabilityBlockBookingConflictError";
      throw error;
    }

    const [existingBlock] = await tx
      .select({ id: vehicleAvailabilityBlocks.id })
      .from(vehicleAvailabilityBlocks)
      .where(and(
        eq(vehicleAvailabilityBlocks.vehicleId, vehicleId),
        lte(vehicleAvailabilityBlocks.startDate, input.endDate),
        gte(vehicleAvailabilityBlocks.endDate, input.startDate),
      ))
      .limit(1);

    if (existingBlock) {
      const error = new Error("These dates overlap with an existing unavailable period.");
      error.name = "AvailabilityBlockConflictError";
      throw error;
    }

    const [block] = await tx
      .insert(vehicleAvailabilityBlocks)
      .values({ vehicleId, ...input })
      .returning({
        id: vehicleAvailabilityBlocks.id,
        startDate: vehicleAvailabilityBlocks.startDate,
        endDate: vehicleAvailabilityBlocks.endDate,
      });

    return block;
  });
}

export async function removeVehicleAvailabilityBlock(userId: string, vehicleId: string, blockId: string) {
  const [vehicle] = await db
    .select({ id: vehicles.id })
    .from(vehicles)
    .innerJoin(dealerProfiles, eq(vehicles.dealerProfileId, dealerProfiles.id))
    .where(and(eq(vehicles.id, vehicleId), eq(dealerProfiles.userId, userId)));

  if (!vehicle) return undefined;

  const [block] = await db
    .delete(vehicleAvailabilityBlocks)
    .where(and(
      eq(vehicleAvailabilityBlocks.id, blockId),
      eq(vehicleAvailabilityBlocks.vehicleId, vehicleId),
    ))
    .returning({ id: vehicleAvailabilityBlocks.id });

  return block;
}


const vehicleFields = {
  id: vehicles.id,
  make: vehicles.make,
  model: vehicles.model,
  year: vehicles.year,
  dailyRate: vehicles.dailyRate,
  location: vehicles.location,
  description: vehicles.description,
  imageUrls: vehicles.imageUrls,
  status: vehicles.status,
  approvalStatus: vehicles.approvalStatus,
  approvalReason: vehicles.approvalReason,
  createdAt: vehicles.createdAt,
  updatedAt: vehicles.updatedAt,
};

export async function listDealerVehicles(userId: string) {
  const [profile] = await db
    .select({ id: dealerProfiles.id })
    .from(dealerProfiles)
    .where(eq(dealerProfiles.userId, userId));

  if (!profile) return [];

  return db
    .select(vehicleFields)
    .from(vehicles)
    .where(eq(vehicles.dealerProfileId, profile.id))
    .orderBy(desc(vehicles.createdAt));
}

export async function listPublishedVehicles() {
  return db
    .select({
      ...vehicleFields,
      businessName: dealerProfiles.businessName,
      businessPhone: dealerProfiles.businessPhone,
    })
    .from(vehicles)
    .innerJoin(dealerProfiles, eq(vehicles.dealerProfileId, dealerProfiles.id))
    .where(
      and(
        eq(vehicles.status, "published"),
        eq(vehicles.approvalStatus, "approved"),
        eq(dealerProfiles.approvalStatus, "approved"),
      ),
    )
    .orderBy(desc(vehicles.createdAt));
}

export async function getPublishedVehicle(vehicleId: string) {
  const [vehicle] = await db
    .select({
      ...vehicleFields,
      businessName: dealerProfiles.businessName,
      businessPhone: dealerProfiles.businessPhone,
      businessEmail: dealerProfiles.businessEmail,
      businessAddress: dealerProfiles.businessAddress,
      dealerLogoUrl: dealerProfiles.logoUrl,
    })
    .from(vehicles)
    .innerJoin(dealerProfiles, eq(vehicles.dealerProfileId, dealerProfiles.id))
    .where(
      and(
        eq(vehicles.id, vehicleId),
        eq(vehicles.status, "published"),
        eq(vehicles.approvalStatus, "approved"),
        eq(dealerProfiles.approvalStatus, "approved"),
      ),
    );

  return vehicle;
}

export async function createVehicle(userId: string, input: VehicleInput) {
  const [profile] = await db
    .select()
    .from(dealerProfiles)
    .where(eq(dealerProfiles.userId, userId));

  if (!profile) {
    const error = new Error("Create your dealer business profile first.");
    error.name = "DealerProfileNotFoundError";
    throw error;
  }

  const [vehicle] = await db
    .insert(vehicles)
    .values({
      dealerProfileId: profile.id,
      ...input,
      status: "draft",
      approvalStatus: "not_submitted",
      updatedAt: new Date(),
    })
    .returning(vehicleFields);

  return vehicle;
}

export async function updateVehicle(userId: string, vehicleId: string, input: VehicleInput) {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({
        id: vehicles.id,
        status: vehicles.status,
        approvalStatus: vehicles.approvalStatus,
      })
      .from(vehicles)
      .innerJoin(dealerProfiles, eq(vehicles.dealerProfileId, dealerProfiles.id))
      .where(and(eq(vehicles.id, vehicleId), eq(dealerProfiles.userId, userId)))
      .for("update");

    if (!existing) return undefined;

    const needsReview = existing.approvalStatus === "approved";
    const [vehicle] = await tx
      .update(vehicles)
      .set({
        ...input,
        ...(needsReview
          ? { status: "draft" as const, approvalStatus: "pending" as const, approvalReason: null }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(vehicles.id, vehicleId))
      .returning(vehicleFields);

    return vehicle;
  });
}

export async function setVehicleStatus(
  userId: string,
  vehicleId: string,
  status: "draft" | "published",
) {
  return db.transaction(async (tx) => {
    const [profile] = await tx
      .select({
        id: dealerProfiles.id,
        approvalStatus: dealerProfiles.approvalStatus,
      })
      .from(dealerProfiles)
      .where(eq(dealerProfiles.userId, userId));

    if (!profile) {
      const error = new Error("Create your dealer business profile first.");
      error.name = "DealerProfileNotFoundError";
      throw error;
    }

    if (status === "draft") {
      const [vehicle] = await tx
        .update(vehicles)
        .set({ status, updatedAt: new Date() })
        .where(and(
          eq(vehicles.dealerProfileId, profile.id),
          eq(vehicles.id, vehicleId),
        ))
        .returning(vehicleFields);
      return vehicle;
    }

    if (profile.approvalStatus !== "approved") {
      const error = new Error("Your dealer account must be approved before submitting vehicles for review.");
      error.name = "DealerNotApprovedError";
      throw error;
    }

    const [existing] = await tx
      .select({
        id: vehicles.id,
        approvalStatus: vehicles.approvalStatus,
        imageUrls: vehicles.imageUrls,
      })
      .from(vehicles)
      .where(and(eq(vehicles.id, vehicleId), eq(vehicles.dealerProfileId, profile.id)))
      .for("update");
    if (!existing) return undefined;
    if (existing.approvalStatus !== "approved" && existing.imageUrls.length === 0) {
      const error = new Error("Add at least one vehicle photo before submitting it for review.");
      error.name = "VehiclePhotoRequiredError";
      throw error;
    }

    const [vehicle] = await tx
      .update(vehicles)
      .set(existing.approvalStatus === "approved"
        ? { status: "published", updatedAt: new Date() }
        : {
          status: "draft",
          approvalStatus: "pending",
          approvalReason: null,
          updatedAt: new Date(),
        })
      .where(eq(vehicles.id, vehicleId))
      .returning(vehicleFields);
    return vehicle;
  });
}

export async function deleteVehicle(userId: string, vehicleId: string) {
  const [profile] = await db
    .select({ id: dealerProfiles.id })
    .from(dealerProfiles)
    .where(eq(dealerProfiles.userId, userId));

  if (!profile) return undefined;

  const [vehicle] = await db
    .delete(vehicles)
    .where(and(eq(vehicles.id, vehicleId), eq(vehicles.dealerProfileId, profile.id)))
    .returning({ id: vehicles.id });

  return vehicle;
}

const vehicleImageTypes = {
  "image/jpeg": (data: Buffer) => data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff,
  "image/png": (data: Buffer) => data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  "image/webp": (data: Buffer) => data.toString("ascii", 0, 4) === "RIFF" && data.toString("ascii", 8, 12) === "WEBP",
} as const;

export async function addVehicleImage(
  userId: string,
  vehicleId: string,
  contentType: string,
  image: Buffer,
) {
  const matchesImage = vehicleImageTypes[contentType as keyof typeof vehicleImageTypes];
  if (!matchesImage || !matchesImage(image)) {
    const error = new Error("Choose a valid JPEG, PNG, or WebP image.");
    error.name = "InvalidVehicleImageError";
    throw error;
  }

  const [vehicle] = await db
    .select({
      id: vehicles.id,
      imageUrls: vehicles.imageUrls,
      approvalStatus: vehicles.approvalStatus,
    })
    .from(vehicles)
    .innerJoin(dealerProfiles, eq(vehicles.dealerProfileId, dealerProfiles.id))
    .where(and(eq(vehicles.id, vehicleId), eq(dealerProfiles.userId, userId)));

  if (!vehicle) {
    const error = new Error("Vehicle listing not found.");
    error.name = "VehicleNotFoundError";
    throw error;
  }
  if (vehicle.imageUrls.length >= 10) {
    const error = new Error("A vehicle can have up to 10 photos.");
    error.name = "VehicleImageLimitError";
    throw error;
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    const error = new Error("Vehicle photo storage is not configured.");
    error.name = "CloudinaryConfigError";
    throw error;
  }

  const extension = contentType === "image/jpeg" ? "jpg" : contentType.slice("image/".length);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const publicId = `drivenow/vehicles/${vehicleId}/${randomUUID()}`;
  const signature = createHash("sha1")
    .update(`public_id=${publicId}&timestamp=${timestamp}${apiSecret}`)
    .digest("hex");
  const form = new FormData();
  form.set("file", new Blob([new Uint8Array(image)], { type: contentType }), `vehicle.${extension}`);
  form.set("api_key", apiKey);
  form.set("public_id", publicId);
  form.set("timestamp", timestamp);
  form.set("signature", signature);

  let uploadResponse: Response;
  try {
    uploadResponse = await fetch(
      `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`,
      { method: "POST", body: form },
    );
  } catch {
    const error = new Error("Unable to reach vehicle photo storage.");
    error.name = "CloudinaryUploadError";
    throw error;
  }

  const uploadResult = (await uploadResponse.json().catch(() => null)) as
    | { secure_url?: string; error?: { message?: string } }
    | null;
  if (!uploadResponse.ok || !uploadResult?.secure_url) {
    console.error("Cloudinary vehicle image upload failed", uploadResult?.error?.message ?? uploadResponse.statusText);
    const error = new Error("Unable to upload vehicle photo.");
    error.name = "CloudinaryUploadError";
    throw error;
  }

  const [updatedVehicle] = await db
    .update(vehicles)
    .set({
      imageUrls: [...vehicle.imageUrls, uploadResult.secure_url],
      ...(vehicle.approvalStatus === "approved"
        ? { status: "draft" as const, approvalStatus: "pending" as const, approvalReason: null }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(vehicles.id, vehicle.id))
    .returning(vehicleFields);

  return updatedVehicle;
}