import { createHash, randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { dealerProfiles, vehicles } from "../db/schema.js";
import type { VehicleInput } from "./vehicle.schemas.js";

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
      updatedAt: new Date(),
    })
    .returning(vehicleFields);

  return vehicle;
}

export async function updateVehicle(userId: string, vehicleId: string, input: VehicleInput) {
  const [vehicle] = await db
    .update(vehicles)
    .set({ ...input, updatedAt: new Date() })
    .from(dealerProfiles)
    .where(
      and(
        eq(vehicles.id, vehicleId),
        eq(vehicles.dealerProfileId, dealerProfiles.id),
        eq(dealerProfiles.userId, userId),
      ),
    )
    .returning(vehicleFields);

  return vehicle;
}

export async function setVehicleStatus(
  userId: string,
  vehicleId: string,
  status: "draft" | "published",
) {
  if (status === "published") {
    const [profile] = await db
      .select({ id: dealerProfiles.id, approvalStatus: dealerProfiles.approvalStatus })
      .from(dealerProfiles)
      .where(eq(dealerProfiles.userId, userId));

    if (!profile) {
      const error = new Error("Create your dealer business profile first.");
      error.name = "DealerProfileNotFoundError";
      throw error;
    }
    if (profile.approvalStatus !== "approved") {
      const error = new Error("Your dealer account must be approved before publishing vehicles.");
      error.name = "DealerNotApprovedError";
      throw error;
    }

    const [vehicle] = await db
      .update(vehicles)
      .set({ status, updatedAt: new Date() })
      .where(and(eq(vehicles.id, vehicleId), eq(vehicles.dealerProfileId, profile.id)))
      .returning(vehicleFields);
    return vehicle;
  }

  const [vehicle] = await db
    .update(vehicles)
    .set({ status, updatedAt: new Date() })
    .from(dealerProfiles)
    .where(
      and(
        eq(vehicles.id, vehicleId),
        eq(vehicles.dealerProfileId, dealerProfiles.id),
        eq(dealerProfiles.userId, userId),
      ),
    )
    .returning(vehicleFields);

  return vehicle;
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
    .select({ id: vehicles.id, imageUrls: vehicles.imageUrls })
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
      updatedAt: new Date(),
    })
    .where(eq(vehicles.id, vehicle.id))
    .returning(vehicleFields);

  return updatedVehicle;
}
