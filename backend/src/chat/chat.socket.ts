import type { Server as HttpServer } from "node:http";
import jwt from "jsonwebtoken";
import { Server, type Socket } from "socket.io";
import { z } from "zod";
import { chatMessageSchema } from "./chat.schemas.js";
import {
  canJoinConversation,
  markConversationRead,
  markMessageDelivered,
  saveChatMessage,
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

export function attachChatSocket(server: HttpServer) {
  const io = new Server(server, {
    cors: {
      origin: frontendOrigin,
      credentials: true,
    },
  });

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
    void socket.join(`user:${user.id}`);

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
        const receipts = await markConversationRead(parsed.data.conversationId, user.id, user.role);
        for (const receipt of receipts ?? []) {
          io.to(`conversation:${parsed.data.conversationId}`).emit("chat:receipt", receipt);
        }
        respond({ success: true });
      } catch (error) {
        console.error("Unable to join chat conversation:", error);
        respond({ success: false, message: "Unable to join this conversation." });
      }
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
          parsed.data.body,
        );
        if (!message) {
          socket.leave(room);
          respond({ success: false, message: "This conversation is no longer available for messaging." });
          return;
        }
        io.to(room).emit("chat:message", message.message);
        io.to(`user:${message.recipientId}`).emit("chat:incoming", {
          conversationId: parsed.data.conversationId,
          messageId: message.message.id,
        });
        io.to(`user:${message.recipientId}`).emit("chat:inbox-updated", {
          bookingId: message.bookingId,
        });
        respond({ success: true, data: { message: message.message } });
      } catch (error) {
        console.error("Unable to save chat message:", error);
        respond({ success: false, message: "Unable to send your message." });
      }
    });
  });

  return io;
}
