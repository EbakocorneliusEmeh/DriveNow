import type { Server as HttpServer } from "node:http";
import jwt from "jsonwebtoken";
import { Server, type Socket } from "socket.io";
import { z } from "zod";
import { chatMessageSchema, chatTypingSchema } from "./chat.schemas.js";
import {
  canJoinConversation,
  getConversationPresence,
  getPresenceSettings,
  listPresenceContacts,
  markConversationRead,
  markMessageDelivered,
  saveChatMessage,
  updateLastSeen,
} from "./chat.service.js";

type SocketUser = {
  id: string;
  role: "customer" | "dealer";
};

type ChatSocket = Socket & {
  data: { user?: SocketUser };
};

const joinSchema = z.object({ conversationId: z.string().uuid() });
const receiptSchema = joinSchema.extend({ messageId: z.string().uuid() });
const frontendOrigin = process.env.FRONTEND_URL ?? "http://localhost:3000";

type PresenceVisibility = "everyone" | "contacts" | "nobody";
type PresenceUpdate = {
  userId: string;
  visibility: PresenceVisibility;
  online: boolean;
  lastSeenAt: Date | null;
};

let chatIo: Server | undefined;
const activeSockets = new Map<string, Set<string>>();

async function announcePresence(userId: string) {
  if (!chatIo) return;

  const settings = await getPresenceSettings(userId);
  if (!settings) return;

  const online = Boolean(activeSockets.get(userId)?.size);
  const update: PresenceUpdate = {
    userId,
    visibility: settings.visibility,
    online,
    lastSeenAt: online ? null : settings.lastSeenAt,
  };
  chatIo.emit("presence:privacy", { userId });

  if (settings.visibility === "everyone") {
    chatIo.emit("presence:update", update);
    return;
  }

  if (settings.visibility === "contacts") {
    if (settings.role !== "customer" && settings.role !== "dealer") return;
    const contactIds = await listPresenceContacts(userId, settings.role);
    for (const contactId of contactIds) {
      chatIo.to(`user:${contactId}`).emit("presence:update", update);
    }
  }
}

export async function publishUserPresence(userId: string) {
  await announcePresence(userId);
}

export function attachChatSocket(server: HttpServer) {
  const io = new Server(server, {
    cors: {
      origin: frontendOrigin,
      credentials: true,
    },
  });
  chatIo = io;

  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    const secret = process.env.JWT_SECRET;
    if (typeof token !== "string" || !secret) {
      next(new Error("Authentication required."));
      return;
    }

    try {
      const payload = jwt.verify(token, secret);
      if (
        typeof payload === "string"
        || typeof payload.sub !== "string"
        || (payload.role !== "customer" && payload.role !== "dealer")
      ) {
        next(new Error("Invalid chat credentials."));
        return;
      }
      (socket as ChatSocket).data.user = { id: payload.sub, role: payload.role };
      next();
    } catch {
      next(new Error("Invalid or expired chat credentials."));
    }
  });

  io.on("connection", (rawSocket) => {
    const socket = rawSocket as ChatSocket;
    const user = socket.data.user;
    if (!user) {
      socket.disconnect(true);
      return;
    }
    const sockets = activeSockets.get(user.id) ?? new Set<string>();
    sockets.add(socket.id);
    activeSockets.set(user.id, sockets);
    void socket.join(`user:${user.id}`);
    void announcePresence(user.id).catch((error) => {
      console.error("Unable to publish user presence:", error);
    });

    const typingConversations = new Map<string, ReturnType<typeof setTimeout>>();

    socket.on("chat:join", async (input: unknown, acknowledge?: (result: unknown) => void) => {
      const respond = typeof acknowledge === "function" ? acknowledge : () => undefined;
      const parsed = joinSchema.safeParse(input);
      if (!parsed.success) {
        respond({ success: false, message: "Invalid conversation." });
        return;
      }
      try {
        const allowed = await canJoinConversation(
          parsed.data.conversationId,
          user.id,
          user.role,
        );
        if (!allowed) {
          respond({ success: false, message: "You cannot join this conversation." });
          return;
        }
        await socket.join(`conversation:${parsed.data.conversationId}`);
        const otherPresence = await getConversationPresence(
          parsed.data.conversationId,
          user.id,
          user.role,
        );
        if (otherPresence && otherPresence.visibility !== "nobody") {
          socket.emit("presence:update", {
            userId: otherPresence.userId,
            visibility: otherPresence.visibility,
            online: Boolean(activeSockets.get(otherPresence.userId)?.size),
            lastSeenAt: activeSockets.get(otherPresence.userId)?.size
              ? null
              : otherPresence.lastSeenAt,
          });
        }
        const receipts = await markConversationRead(parsed.data.conversationId, user.id, user.role);
        for (const receipt of receipts ?? []) {
          io.to(`conversation:${parsed.data.conversationId}`).emit("chat:receipt", receipt);
        }
        io.to(`user:${user.id}`).emit("chat:inbox-updated", {
          conversationId: parsed.data.conversationId,
        });
        respond({
          success: true,
          presence: otherPresence && otherPresence.visibility !== "nobody"
            ? {
              userId: otherPresence.userId,
              visibility: otherPresence.visibility,
              online: Boolean(activeSockets.get(otherPresence.userId)?.size),
              lastSeenAt: activeSockets.get(otherPresence.userId)?.size
                ? null
                : otherPresence.lastSeenAt,
            }
            : null,
        });
      } catch (error) {
        console.error("Unable to join chat conversation:", error);
        respond({ success: false, message: "Unable to join this conversation." });
      }
    });

    socket.on("chat:typing", (input: unknown) => {
      const parsed = chatTypingSchema.safeParse(input);
      if (!parsed.success) return;

      const room = `conversation:${parsed.data.conversationId}`;
      if (!socket.rooms.has(room)) return;

      const existingTimer = typingConversations.get(parsed.data.conversationId);
      if (existingTimer) clearTimeout(existingTimer);

      if (!parsed.data.isTyping) {
        typingConversations.delete(parsed.data.conversationId);
        socket.to(room).emit("chat:typing", { userId: user.id, isTyping: false });
        return;
      }

      socket.to(room).emit("chat:typing", { userId: user.id, isTyping: true });
      typingConversations.set(parsed.data.conversationId, setTimeout(() => {
        typingConversations.delete(parsed.data.conversationId);
        socket.to(room).emit("chat:typing", { userId: user.id, isTyping: false });
      }, 4_000));
    });



    socket.on("chat:read", async (input: unknown) => {
      const parsed = joinSchema.safeParse(input);
      if (!parsed.success || !socket.rooms.has(`conversation:${parsed.data.conversationId}`)) return;
      try {
        const receipts = await markConversationRead(parsed.data.conversationId, user.id, user.role);
        for (const receipt of receipts ?? []) {
          io.to(`conversation:${parsed.data.conversationId}`).emit("chat:receipt", receipt);
        }
        io.to(`user:${user.id}`).emit("chat:inbox-updated", {
          conversationId: parsed.data.conversationId,
        });
      } catch (error) {
        console.error("Unable to mark chat messages as read:", error);
      }
    });

    socket.on("chat:delivered", async (input: unknown) => {
      const parsed = receiptSchema.safeParse(input);
      if (!parsed.success) return;

      try {
        const receipt = await markMessageDelivered(
          parsed.data.conversationId,
          parsed.data.messageId,
          user.id,
          user.role,
        );
        if (receipt) {
          io.to(`conversation:${parsed.data.conversationId}`).emit("chat:receipt", receipt);
        }
      } catch (error) {
        console.error("Unable to mark chat message as delivered:", error);
      }
    });

    socket.on("chat:send", async (input: unknown, acknowledge?: (result: unknown) => void) => {
      const respond = typeof acknowledge === "function" ? acknowledge : () => undefined;
      const parsed = chatMessageSchema.safeParse(input);
      if (!parsed.success) {
        respond({ success: false, message: "Messages must contain 1 to 4,000 characters." });
        return;
      }

      const room = `conversation:${parsed.data.conversationId}`;
      if (!socket.rooms.has(room)) {
        respond({ success: false, message: "Join this conversation before sending a message." });
        return;
      }

      try {
        const message = await saveChatMessage(
          parsed.data.conversationId,
          user.id,
          user.role,
          parsed.data.clientMessageId,
          parsed.data.body,
        );
        if (!message) {
          socket.leave(room);
          respond({ success: false, message: "This conversation is no longer available for messaging." });
          return;
        }
        const typingTimer = typingConversations.get(parsed.data.conversationId);
        if (typingTimer) clearTimeout(typingTimer);
        typingConversations.delete(parsed.data.conversationId);
        socket.to(room).emit("chat:typing", { userId: user.id, isTyping: false });
        io.to(room).emit("chat:message", message.message);
        if (message.created) {
          io.to(`user:${message.recipientId}`).emit("chat:incoming", {
            conversationId: parsed.data.conversationId,
            messageId: message.message.id,
          });
          io.to(`user:${message.recipientId}`).emit("chat:inbox-updated", {
            bookingId: message.bookingId,
          });
        }
        respond({ success: true, data: { message: message.message } });
      } catch (error) {
        console.error("Unable to save chat message:", error);
        respond({ success: false, message: "Unable to send your message." });
      }
    });

    socket.on("disconnect", () => {
      for (const [conversationId, timer] of typingConversations) {
        clearTimeout(timer);
        socket.to(`conversation:${conversationId}`).emit("chat:typing", {
          userId: user.id,
          isTyping: false,
        });
      }

      const userSockets = activeSockets.get(user.id);
      userSockets?.delete(socket.id);
      if (userSockets?.size) return;
      activeSockets.delete(user.id);
      void updateLastSeen(user.id, new Date())
        .then(() => announcePresence(user.id))
        .catch((error) => console.error("Unable to update user last seen:", error));
    });
  });

  return io;
}
