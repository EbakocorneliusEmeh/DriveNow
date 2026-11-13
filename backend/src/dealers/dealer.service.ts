import { createHash, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { dealerProfiles } from "../db/schema.js";
import type { DealerApplicationInput, DealerProfileUpdateInput } from "./dealer.schemas.js";

const profileFields = {
  id: dealerProfiles.id,
  businessName: dealerProfiles.businessName,
  businessEmail: dealerProfiles.businessEmail,
  businessPhone: dealerProfiles.businessPhone,
  businessAddress: dealerProfiles.businessAddress,
  description: dealerProfiles.description,
  logoUrl: dealerProfiles.logoUrl,
  profilePictureUrl: dealerProfiles.profilePictureUrl,
  documentUrls: dealerProfiles.documentUrls,
  approvalStatus: dealerProfiles.approvalStatus,
  approvalReason: dealerProfiles.approvalReason,
  createdAt: dealerProfiles.createdAt,
  updatedAt: dealerProfiles.updatedAt,
};

export async function getDealerProfile(userId: string) {
  const [profile] = await db
    .select(profileFields)
    .from(dealerProfiles)
    .where(eq(dealerProfiles.userId, userId));

  return profile;
}

export async function submitDealerApplication(
  userId: string,
  input: DealerApplicationInput,
) {
  const existingProfile = await getDealerProfile(userId);
  const values = {
    businessName: input.businessName,
    businessEmail: input.businessEmail,
    businessPhone: input.businessPhone,
    businessAddress: input.businessAddress,
    description: input.description,
    logoUrl: input.logoUrl ?? null,
    documentUrls: input.documentUrls,
    updatedAt: new Date(),
  };

  if (existingProfile) {
    const [profile] = await db
      .update(dealerProfiles)
      .set({ ...values, approvalStatus: "pending", approvalReason: null })
      .where(eq(dealerProfiles.userId, userId))
      .returning(profileFields);
    return profile;
  }

  const [profile] = await db
    .insert(dealerProfiles)
    .values({ userId, ...values })
    .returning(profileFields);
  return profile;
}

export async function updateDealerProfile(
  userId: string,
  input: DealerProfileUpdateInput,
) {
  const [profile] = await db
    .update(dealerProfiles)
    .set({
      businessName: input.businessName,
      businessEmail: input.businessEmail,
      businessPhone: input.businessPhone,
      businessAddress: input.businessAddress,
      description: input.description,
      ...(input.logoUrl !== undefined ? { logoUrl: input.logoUrl ?? null } : {}),
      updatedAt: new Date(),
    })
    .where(eq(dealerProfiles.userId, userId))
    .returning(profileFields);

  return profile;
}

const dealerImageTypes = {
  "image/jpeg": (data: Buffer) => data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff,
  "image/png": (data: Buffer) => data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  "image/webp": (data: Buffer) => data.toString("ascii", 0, 4) === "RIFF" && data.toString("ascii", 8, 12) === "WEBP",
} as const;

async function updateDealerImage(
  userId: string,
  contentType: string,
  image: Buffer,
  imageField: "logoUrl" | "profilePictureUrl",
) {
  const matchesImage = dealerImageTypes[contentType as keyof typeof dealerImageTypes];
  if (!matchesImage || !matchesImage(image)) {
    const error = new Error("Choose a valid JPEG, PNG, or WebP image");
    error.name = "InvalidDealerImageError";
    throw error;
  }

  const existingProfile = await getDealerProfile(userId);
  if (!existingProfile) {
    const error = new Error("Create your dealer business profile before adding a logo");
    error.name = "DealerProfileNotFoundError";
    throw error;
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    const error = new Error("Business image storage is not configured");
    error.name = "CloudinaryConfigError";
    throw error;
  }

  const extension = contentType === "image/jpeg" ? "jpg" : contentType.slice("image/".length);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const publicId = `drivenow/dealers/${userId}/${randomUUID()}`;
  const signature = createHash("sha1")
    .update(`public_id=${publicId}&timestamp=${timestamp}${apiSecret}`)
    .digest("hex");
  const form = new FormData();
  form.set("file", new Blob([new Uint8Array(image)], { type: contentType }), `business.${extension}`);
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
    const error = new Error("Unable to reach business image storage");
    error.name = "CloudinaryUploadError";
    throw error;
  }

  const uploadResult = (await uploadResponse.json().catch(() => null)) as
    | { secure_url?: string; error?: { message?: string } }
    | null;
  if (!uploadResponse.ok || !uploadResult?.secure_url) {
    console.error("Cloudinary dealer image upload failed", uploadResult?.error?.message ?? uploadResponse.statusText);
    const error = new Error("Unable to upload your business image");
    error.name = "CloudinaryUploadError";
    throw error;
  }

  const [profile] = await db
    .update(dealerProfiles)
    .set({
      ...(imageField === "logoUrl"
        ? { logoUrl: uploadResult.secure_url }
        : { profilePictureUrl: uploadResult.secure_url }),
      updatedAt: new Date(),
    })
    .where(eq(dealerProfiles.userId, userId))
    .returning(profileFields);

  if (!profile) throw new Error("Dealer profile not found");
  return profile;
}

export function updateDealerLogo(userId: string, contentType: string, image: Buffer) {
  return updateDealerImage(userId, contentType, image, "logoUrl");
}

export function updateDealerProfilePicture(userId: string, contentType: string, image: Buffer) {
  return updateDealerImage(userId, contentType, image, "profilePictureUrl");
}
