import { count, desc, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { dealerProfiles, users } from "../db/schema.js";

const applicationFields = {
  id: dealerProfiles.id,
  businessName: dealerProfiles.businessName,
  businessEmail: dealerProfiles.businessEmail,
  businessPhone: dealerProfiles.businessPhone,
  businessAddress: dealerProfiles.businessAddress,
  description: dealerProfiles.description,
  logoUrl: dealerProfiles.logoUrl,
  documentUrls: dealerProfiles.documentUrls,
  approvalStatus: dealerProfiles.approvalStatus,
  updatedAt: dealerProfiles.updatedAt,
  applicantName: users.fullName,
  applicantEmail: users.email,
};

const userFields = {
  id: users.id,
  fullName: users.fullName,
  email: users.email,
  phone: users.phone,
  role: users.role,
  emailVerified: users.emailVerified,
  phoneVerified: users.phoneVerified,
  createdAt: users.createdAt,
};

export async function getAdminDashboardStats() {
  const [[userTotal], [dealerTotal], [pendingTotal]] = await Promise.all([
    db.select({ value: count() }).from(users),
    db.select({ value: count() }).from(dealerProfiles),
    db
      .select({ value: count() })
      .from(dealerProfiles)
      .where(eq(dealerProfiles.approvalStatus, "pending")),
  ]);

  return {
    totalUsers: userTotal?.value ?? 0,
    dealerApplications: dealerTotal?.value ?? 0,
    pendingDealerApplications: pendingTotal?.value ?? 0,
  };
}

export async function listDealerApplications() {
  return db
    .select(applicationFields)
    .from(dealerProfiles)
    .innerJoin(users, eq(dealerProfiles.userId, users.id))
    .orderBy(desc(dealerProfiles.updatedAt));
}

export async function listUsers() {
  return db
    .select(userFields)
    .from(users)
    .orderBy(desc(users.createdAt));
}

export async function reviewDealerApplication(
  applicationId: string,
  decision: "approved" | "rejected",
) {
  return db.transaction(async (transaction) => {
    const [application] = await transaction
      .update(dealerProfiles)
      .set({ approvalStatus: decision, updatedAt: new Date() })
      .where(eq(dealerProfiles.id, applicationId))
      .returning({ userId: dealerProfiles.userId, approvalStatus: dealerProfiles.approvalStatus });

    if (!application) return undefined;

    if (decision === "approved") {
      await transaction
        .update(users)
        .set({ role: "dealer", updatedAt: new Date() })
        .where(eq(users.id, application.userId));
    }

    return application;
  });
}
