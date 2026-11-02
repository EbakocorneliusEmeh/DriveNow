import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "../db/index.js";
import { notifications, pushInstallations, users } from "../db/schema.js";

function firebaseMessaging() {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) return undefined;
  const app = getApps()[0] ?? initializeApp({
    credential: applicationDefault(),
    projectId: process.env.FIREBASE_PROJECT_ID,
  });
  return getMessaging(app);
}

export async function registerInstallation(userId: string, installationId: string) {
  const now = new Date();
  await db
    .insert(pushInstallations)
    .values({ userId, installationId, lastSeenAt: now })
    .onConflictDoUpdate({
      target: pushInstallations.installationId,
      set: { userId, lastSeenAt: now },
    });
}

export async function listNotifications(userId: string) {
  return db
    .select({
      id: notifications.id,
      title: notifications.title,
      body: notifications.body,
      link: notifications.link,
      readAt: notifications.readAt,
      createdAt: notifications.createdAt,
    })
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(50);
}

export async function markNotificationRead(userId: string, notificationId: string) {
  const [notification] = await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(
      eq(notifications.id, notificationId),
      eq(notifications.userId, userId),
      isNull(notifications.readAt),
    ))
    .returning({ id: notifications.id });
  return notification;
}

export async function createNotification(input: {
  userId: string;
  title: string;
  body: string;
  link?: string;
}) {
  const [notification] = await db
    .insert(notifications)
    .values(input)
    .returning({ id: notifications.id });

  try {
    const messaging = firebaseMessaging();
    if (messaging) {
      const installations = await db
        .select({ fid: pushInstallations.installationId })
        .from(pushInstallations)
        .where(eq(pushInstallations.userId, input.userId));
      await Promise.all(installations.map(({ fid }) => messaging.send({
        fid,
        notification: { title: input.title, body: input.body },
        data: { link: input.link ?? "/dashboard", notificationId: notification.id },
      })));
    }
  } catch (error) {
    console.error("Unable to send Firebase push notification:", error);
  }

  return notification;
}

export async function notifyAdmins(input: { title: string; body: string; link?: string }) {
  const admins = await db.select({ id: users.id }).from(users).where(eq(users.role, "admin"));
  await Promise.all(admins.map(({ id }) => createNotification({ ...input, userId: id })));
}

