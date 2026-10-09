import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { dealerProfiles } from "../db/schema.js";
import type { DealerApplicationInput } from "./dealer.schemas.js";

const profileFields = {
  id: dealerProfiles.id,
  businessName: dealerProfiles.businessName,
  businessEmail: dealerProfiles.businessEmail,
  businessPhone: dealerProfiles.businessPhone,
  businessAddress: dealerProfiles.businessAddress,
  description: dealerProfiles.description,
  logoUrl: dealerProfiles.logoUrl,
  documentUrls: dealerProfiles.documentUrls,
  approvalStatus: dealerProfiles.approvalStatus,
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
      .set({ ...values, approvalStatus: "pending" })
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
