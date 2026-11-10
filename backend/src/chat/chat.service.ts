import { and, count, desc, eq, gt, isNotNull, isNull, ne, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  bookings,
  chatMessages,
  chatReviewLogs,
  conversations,
  dealerProfiles,
  users,
  vehicles,
} from "../db/schema.js";
import { createNotification, notifyAdmins } from "../notifications/notifications.service.js";

type ChatRole = "customer" | "dealer" | "admin";

async function findConversationAccess(conversationId: string) {
  const [record] = await db
    .select({
      conversationId: conversations.id,
      bookingId: bookings.id,
      bookingStatus: bookings.status,
      customerId: bookings.customerId,
      customerName: users.fullName,
      dealerUserId: dealerProfiles.userId,
      dealerName: dealerProfiles.businessName,
      vehicleId: vehicles.id,
      make: vehicles.make,
      model: vehicles.model,
      year: vehicles.year,
      imageUrls: vehicles.imageUrls,
      startDate: bookings.startDate,
      endDate: bookings.endDate,
      estimatedTotal: bookings.estimatedTotal,
      reportedAt: conversations.reportedAt,
      reportReason: conversations.reportReason,
    })
    .from(conversations)
    .innerJoin(bookings, eq(conversations.bookingId, bookings.id))
    .innerJoin(vehicles, eq(bookings.vehicleId, vehicles.id))
    .innerJoin(dealerProfiles, eq(vehicles.dealerProfileId, dealerProfiles.id))
    .innerJoin(users, eq(bookings.customerId, users.id))
    .where(eq(conversations.id, conversationId));
  return record;
}

function isParticipant(
  record: { customerId: string; dealerUserId: string },
  userId: string,
  role: ChatRole,
) {
  return (role === "customer" && record.customerId === userId)
    || (role === "dealer" && record.dealerUserId === userId);
}

export async function listUserConversations(userId: string, role: ChatRole) {
  const participantCondition = role === "customer"
    ? eq(bookings.customerId, userId)
    : eq(dealerProfiles.userId, userId);

  const records = await db
    .select({
      conversationId: conversations.id,
      bookingId: bookings.id,
      bookingStatus: bookings.status,
      vehicleId: vehicles.id,
      make: vehicles.make,
      model: vehicles.model,
      year: vehicles.year,
      imageUrls: vehicles.imageUrls,
      startDate: bookings.startDate,
      endDate: bookings.endDate,
      customerLastReadAt: conversations.customerLastReadAt,
      dealerLastReadAt: conversations.dealerLastReadAt,
      otherPartyName: role === "customer" ? dealerProfiles.businessName : users.fullName,
      updatedAt: conversations.updatedAt,
    })
    .from(conversations)
    .innerJoin(bookings, eq(conversations.bookingId, bookings.id))
    .innerJoin(vehicles, eq(bookings.vehicleId, vehicles.id))
    .innerJoin(dealerProfiles, eq(vehicles.dealerProfileId, dealerProfiles.id))
    .innerJoin(users, eq(bookings.customerId, users.id))
    .where(participantCondition)
    .orderBy(desc(conversations.updatedAt));

  return Promise.all(records.map(async (record) => {
    const readAt = role === "customer" ? record.customerLastReadAt : record.dealerLastReadAt;
    const [lastMessages, [unread]] = await Promise.all([
      db
      .select({
        body: chatMessages.body,
        createdAt: chatMessages.createdAt,
        senderId: chatMessages.senderId,
      })
      .from(chatMessages)
      .where(eq(chatMessages.conversationId, record.conversationId))
      .orderBy(desc(chatMessages.createdAt))
      .limit(1),
      db
        .select({ unreadCount: count(chatMessages.id) })
        .from(chatMessages)
        .where(and(
          eq(chatMessages.conversationId, record.conversationId),
          ne(chatMessages.senderId, userId),
          readAt ? gt(chatMessages.createdAt, readAt) : undefined,
        )),
    ]);
    return {
      ...record,
      lastMessage: lastMessages[0] ?? null,
      unreadCount: unread?.unreadCount ?? 0,
    };
  }));
}

export async function getConversationForParticipant(
  conversationId: string,
  userId: string,
  role: ChatRole,
) {
  const record = await findConversationAccess(conversationId);
  if (!record) return undefined;
  if (!isParticipant(record, userId, role)) return undefined;
  if (record.bookingStatus !== "confirmed" && record.bookingStatus !== "cancelled") {
    return undefined;
  }

  const messages = await db
    .select({
      id: chatMessages.id,
      senderId: chatMessages.senderId,
      senderName: users.fullName,
      body: chatMessages.body,
      createdAt: chatMessages.createdAt,
      deliveredAt: chatMessages.deliveredAt,
      readAt: chatMessages.readAt,
    })
    .from(chatMessages)
    .innerJoin(users, eq(chatMessages.senderId, users.id))
    .where(eq(chatMessages.conversationId, conversationId))
    .orderBy(desc(chatMessages.createdAt))
    .limit(200);

  return { ...record, messages: messages.reverse() };
}

export async function getBookingConversationForParticipant(
  bookingId: string,
  userId: string,
  role: ChatRole,
) {
  const [conversation] = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(eq(conversations.bookingId, bookingId));
  if (!conversation) return undefined;
  return getConversationForParticipant(conversation.id, userId, role);
}

export async function canJoinConversation(
  conversationId: string,
  userId: string,
  role: ChatRole,
) {
  const record = await findConversationAccess(conversationId);
  return Boolean(record
    && isParticipant(record, userId, role)
    && record.bookingStatus === "confirmed");
}

export async function markConversationRead(
  conversationId: string,
  userId: string,
  role: "customer" | "dealer",
) {
  const record = await findConversationAccess(conversationId);
  if (!record
    || !isParticipant(record, userId, role)
    || (record.bookingStatus !== "confirmed" && record.bookingStatus !== "cancelled")) {
    return undefined;
  }

  const now = new Date();
  return db.transaction(async (tx) => {
    await tx
      .update(conversations)
      .set(role === "customer"
        ? { customerLastReadAt: now, updatedAt: now }
        : { dealerLastReadAt: now, updatedAt: now })
      .where(eq(conversations.id, conversationId));

    return tx
      .update(chatMessages)
      .set({
        deliveredAt: sql`coalesce(${chatMessages.deliveredAt}, ${now})`,
        readAt: now,
      })
      .where(and(
        eq(chatMessages.conversationId, conversationId),
        ne(chatMessages.senderId, userId),
        isNull(chatMessages.readAt),
      ))
      .returning({
        id: chatMessages.id,
        deliveredAt: chatMessages.deliveredAt,
        readAt: chatMessages.readAt,
      });
  });
}

export async function markMessageDelivered(
  conversationId: string,
  messageId: string,
  userId: string,
  role: "customer" | "dealer",
) {
  const record = await findConversationAccess(conversationId);
  if (!record
    || !isParticipant(record, userId, role)
    || record.bookingStatus !== "confirmed") {
    return undefined;
  }

  const [receipt] = await db
    .update(chatMessages)
    .set({ deliveredAt: new Date() })
    .where(and(
      eq(chatMessages.id, messageId),
      eq(chatMessages.conversationId, conversationId),
      ne(chatMessages.senderId, userId),
      isNull(chatMessages.deliveredAt),
    ))
    .returning({
      id: chatMessages.id,
      deliveredAt: chatMessages.deliveredAt,
      readAt: chatMessages.readAt,
    });
  return receipt;
}

export async function saveChatMessage(
  conversationId: string,
  userId: string,
  role: "customer" | "dealer",
  body: string,
) {
  const result = await db.transaction(async (tx) => {
    const [conversation] = await tx
      .select({
        id: conversations.id,
        bookingId: conversations.bookingId,
      })
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .for("update");
    if (!conversation) return undefined;

    const [booking] = await tx
      .select({
        status: bookings.status,
        customerId: bookings.customerId,
        vehicleId: vehicles.id,
        make: vehicles.make,
        model: vehicles.model,
        year: vehicles.year,
        dealerUserId: dealerProfiles.userId,
      })
      .from(bookings)
      .innerJoin(vehicles, eq(bookings.vehicleId, vehicles.id))
      .innerJoin(dealerProfiles, eq(vehicles.dealerProfileId, dealerProfiles.id))
      .where(eq(bookings.id, conversation.bookingId));
    if (!booking || booking.status !== "confirmed") return undefined;

    const isCustomer = role === "customer" && booking.customerId === userId;
    const isDealer = role === "dealer" && booking.dealerUserId === userId;
    if (!isCustomer && !isDealer) return undefined;

    const now = new Date();
    const [message] = await tx
      .insert(chatMessages)
      .values({ conversationId, senderId: userId, body })
      .returning({
        id: chatMessages.id,
        senderId: chatMessages.senderId,
        body: chatMessages.body,
        createdAt: chatMessages.createdAt,
        deliveredAt: chatMessages.deliveredAt,
        readAt: chatMessages.readAt,
      });

    await tx
      .update(conversations)
      .set(isCustomer
        ? { customerLastReadAt: now, updatedAt: now }
        : { dealerLastReadAt: now, updatedAt: now })
      .where(eq(conversations.id, conversationId));

    const [sender] = await tx
      .select({ fullName: users.fullName })
      .from(users)
      .where(eq(users.id, userId));

    return {
      message: { ...message, senderName: sender?.fullName ?? "DriveNow user" },
      recipientId: isCustomer ? booking.dealerUserId : booking.customerId,
      vehicleName: `${booking.year} ${booking.make} ${booking.model}`,
      bookingId: conversation.bookingId,
    };
  });

  if (!result) return undefined;

  try {
    await createNotification({
      userId: result.recipientId,
      title: "New booking message",
      body: `${result.vehicleName}: ${body.slice(0, 120)}`,
      link: `/dashboard/bookings/${result.bookingId}/chat`,
    });
  } catch (error) {
    console.error("Chat message was saved, but notification delivery failed:", error);
  }
  return {
    message: result.message,
    recipientId: result.recipientId,
    bookingId: result.bookingId,
  };
}

export async function reportConversation(
  conversationId: string,
  userId: string,
  role: ChatRole,
  reason: string,
) {
  const record = await findConversationAccess(conversationId);
  if (!record || !isParticipant(record, userId, role)) return undefined;
  if (record.reportedAt) {
    return { alreadyReported: true };
  }

  const [updated] = await db
    .update(conversations)
    .set({
      reportedById: userId,
      reportReason: reason,
      reportedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(conversations.id, conversationId), isNull(conversations.reportedAt)))
    .returning({ id: conversations.id });
  if (!updated) return { alreadyReported: true };

  try {
    await notifyAdmins({
      title: "Booking chat reported",
      body: `${record.year} ${record.make} ${record.model}: ${reason.slice(0, 120)}`,
      link: "/admin#chat-reports",
    });
  } catch (error) {
    console.error("Chat report was saved, but admins could not be notified:", error);
  }

  return { alreadyReported: false };
}

export async function listReportedConversations() {
  return db
    .select({
      conversationId: conversations.id,
      bookingId: bookings.id,
      reportReason: conversations.reportReason,
      reportedAt: conversations.reportedAt,
      reportedById: conversations.reportedById,
      make: vehicles.make,
      model: vehicles.model,
      year: vehicles.year,
      customerName: users.fullName,
      dealerName: dealerProfiles.businessName,
    })
    .from(conversations)
    .innerJoin(bookings, eq(conversations.bookingId, bookings.id))
    .innerJoin(vehicles, eq(bookings.vehicleId, vehicles.id))
    .innerJoin(dealerProfiles, eq(vehicles.dealerProfileId, dealerProfiles.id))
    .innerJoin(users, eq(bookings.customerId, users.id))
    .where(and(isNotNull(conversations.reportedAt), isNull(conversations.reportReviewedAt)))
    .orderBy(desc(conversations.reportedAt));
}

export async function reviewReportedConversation(conversationId: string, adminId: string) {
  const record = await findConversationAccess(conversationId);
  if (!record || !record.reportedAt) return undefined;

  await db.transaction(async (tx) => {
    await tx.insert(chatReviewLogs).values({ conversationId, adminId });
    await tx
      .update(conversations)
      .set({ reportReviewedAt: new Date(), reportReviewedById: adminId })
      .where(eq(conversations.id, conversationId));
  });

  const messages = await db
    .select({
      id: chatMessages.id,
      senderId: chatMessages.senderId,
      senderName: users.fullName,
      body: chatMessages.body,
      createdAt: chatMessages.createdAt,
    })
    .from(chatMessages)
    .innerJoin(users, eq(chatMessages.senderId, users.id))
    .where(eq(chatMessages.conversationId, conversationId))
    .orderBy(chatMessages.createdAt)
    .limit(500);

  return { ...record, messages };
}
