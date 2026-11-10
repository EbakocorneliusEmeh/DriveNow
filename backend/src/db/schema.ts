import {
  boolean,
  date,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", ["customer", "dealer", "admin"]);
export const authTokenType = pgEnum("auth_token_type", [
  "email_verification",
  "phone_verification",
  "password_reset",
]);

export const dealerApprovalStatus = pgEnum("dealer_approval_status", [
  "pending",
  "approved",
  "rejected",
]);

export const vehicleListingStatus = pgEnum("vehicle_listing_status", ["draft", "published"]);
export const bookingStatus = pgEnum("booking_status", ["pending", "confirmed", "declined", "cancelled"]);

export const vehicleType = pgEnum("vehicle_type", ["sedan", "suv", "truck", "van", "coupe", "convertible"]);
export const transmissionType = pgEnum("transmission_type", ["automatic", "manual"]);
export const fuelType = pgEnum("fuel_type", ["gasoline", "diesel", "electric", "hybrid"]);
export const presenceVisibility = pgEnum("presence_visibility", ["everyone", "contacts", "nobody"]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  fullName: text("full_name").notNull(),
  avatarUrl: text("avatar_url"),
  email: text("email").notNull().unique(),
  phone: text("phone").notNull().unique(),
  passwordHash: text("password_hash"),
  googleId: text("google_id").unique(),
  role: userRole("role").default("customer").notNull(),
  presenceVisibility: presenceVisibility("presence_visibility").default("contacts").notNull(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  phoneVerified: boolean("phone_verified").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const authTokens = pgTable("auth_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  type: authTokenType("type").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const refreshTokens = pgTable("refresh_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const dealerProfiles = pgTable("dealer_profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull()
    .unique(),
  businessName: text("business_name").notNull(),
  businessEmail: text("business_email").notNull(),
  businessPhone: text("business_phone").notNull(),
  businessAddress: text("business_address").notNull(),
  description: text("description").notNull(),
  logoUrl: text("logo_url"),
  profilePictureUrl: text("profile_picture_url"),
  documentUrls: jsonb("document_urls").$type<string[]>().notNull(),
  approvalStatus: dealerApprovalStatus("approval_status")
    .default("pending")
    .notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const vehicles = pgTable("vehicles", {
  id: uuid("id").defaultRandom().primaryKey(),
  dealerProfileId: uuid("dealer_profile_id")
    .references(() => dealerProfiles.id, { onDelete: "cascade" })
    .notNull(),
  make: text("make").notNull(),
  model: text("model").notNull(),
  year: integer("year").notNull(),
  dailyRate: integer("daily_rate").notNull(),
  location: text("location").notNull(),
  description: text("description").notNull(),
  imageUrls: jsonb("image_urls").$type<string[]>().notNull(),
  vehicleType: vehicleType("vehicle_type"),
  transmission: transmissionType("transmission"),
  fuelType: fuelType("fuel_type"),
  seatingCapacity: integer("seating_capacity"),
  status: vehicleListingStatus("status").default("draft").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const bookings = pgTable("bookings", {
  id: uuid("id").defaultRandom().primaryKey(),
  vehicleId: uuid("vehicle_id")
    .references(() => vehicles.id, { onDelete: "cascade" })
    .notNull(),
  customerId: uuid("customer_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  totalDays: integer("total_days").notNull(),
  estimatedTotal: integer("estimated_total").notNull(),
  message: text("message").notNull().default(""),
  status: bookingStatus("status").default("pending").notNull(),
  cancelledById: uuid("cancelled_by_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const vehicleAvailabilityBlocks = pgTable("vehicle_availability_blocks", {
  id: uuid("id").defaultRandom().primaryKey(),
  vehicleId: uuid("vehicle_id")
    .references(() => vehicles.id, { onDelete: "cascade" })
    .notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const conversations = pgTable("conversations", {
  id: uuid("id").defaultRandom().primaryKey(),
  bookingId: uuid("booking_id")
    .references(() => bookings.id, { onDelete: "cascade" })
    .notNull()
    .unique(),
  customerLastReadAt: timestamp("customer_last_read_at", { withTimezone: true }),
  dealerLastReadAt: timestamp("dealer_last_read_at", { withTimezone: true }),
  reportedById: uuid("reported_by_id").references(() => users.id, { onDelete: "set null" }),
  reportReason: text("report_reason"),
  reportedAt: timestamp("reported_at", { withTimezone: true }),
  reportReviewedAt: timestamp("report_reviewed_at", { withTimezone: true }),
  reportReviewedById: uuid("report_reviewed_by_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const chatMessages = pgTable("chat_messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  conversationId: uuid("conversation_id")
    .references(() => conversations.id, { onDelete: "cascade" })
    .notNull(),
  senderId: uuid("sender_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  body: text("body").notNull(),
  clientMessageId: uuid("client_message_id"),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
}, (table) => [
  uniqueIndex("chat_messages_sender_client_message_id_unique")
    .on(table.senderId, table.clientMessageId),
]);

export const chatReviewLogs = pgTable("chat_review_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  conversationId: uuid("conversation_id")
    .references(() => conversations.id, { onDelete: "cascade" })
    .notNull(),
  adminId: uuid("admin_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  accessedAt: timestamp("accessed_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const pushInstallations = pgTable("push_installations", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  installationId: text("installation_id").notNull().unique(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const notifications = pgTable("notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  link: text("link"),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});