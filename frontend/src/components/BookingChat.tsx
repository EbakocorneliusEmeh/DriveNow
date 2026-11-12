"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { io, type Socket } from "socket.io-client";
import { useAuth } from "@/hooks/useAuth";
import {
  listQueuedMessages,
  removeQueuedMessage,
  saveQueuedMessage,
  updateQueuedMessageStatus,
  type QueuedChatMessage,
} from "@/lib/chat-outbox";

const API_URL = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api"}/chat`;
const SOCKET_URL = new URL(API_URL).origin;

type ChatMessage = {
  id: string;
  senderId: string;
  senderName: string;
  body: string;
  createdAt: string;
  deliveredAt: string | null;
  readAt: string | null;
  clientMessageId: string | null;
  sendState: "pending" | "sent" | "failed";
};

type ChatReceipt = Pick<ChatMessage, "id" | "deliveredAt" | "readAt">;

type Conversation = {
  conversationId: string;
  bookingId: string;
  bookingStatus: "confirmed" | "cancelled";
  customerId: string;
  customerName: string;
  dealerUserId: string;
  dealerName: string;
  vehicleId: string;
  make: string;
  model: string;
  year: number;
  imageUrls: string[];
  startDate: string;
  endDate: string;
  estimatedTotal: number;
  reportedAt: string | null;
  reportReason: string | null;
  messages: ChatMessage[];
};

type ApiResponse = {
  success: boolean;
  message?: string;
  data?: { conversation: Conversation };
};

type SocketAck = {
  success: boolean;
  message?: string;
  data?: { message: ChatMessage };
  presence?: PresenceUpdate | null;
};

type PresenceUpdate = {
  userId: string;
  visibility: "everyone" | "contacts" | "nobody";
  online: boolean;
  lastSeenAt: string | null;
};

function upsertMessage(messages: ChatMessage[], incoming: ChatMessage) {
  const index = messages.findIndex((message) => message.id === incoming.id
    || Boolean(incoming.clientMessageId && message.clientMessageId === incoming.clientMessageId));
  if (index < 0) return [...messages, incoming];
  return messages.map((message, itemIndex) => itemIndex === index
    ? { ...message, ...incoming }
    : message);
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Unable to encode the voice note."));
    };
    reader.onerror = () => reject(new Error("Unable to read the voice note."));
    reader.readAsDataURL(blob);
  });
}

function isVoiceMessage(body: string) {
  return body.startsWith("data:audio/") || body.startsWith("voice:");
}

export default function BookingChat({ bookingId }: { bookingId: string }) {
  const { user, role, isLoading: isAuthLoading } = useAuth();
  const userId = user?.id;
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageText, setMessageText] = useState("");
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reporting, setReporting] = useState(false);
  const [reportMessage, setReportMessage] = useState("");
  const [outboxError, setOutboxError] = useState("");
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const [presence, setPresence] = useState<PresenceUpdate | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const socketRef = useRef<Socket | null>(null);
  const joinedConversationRef = useRef(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const recordingTimerRef = useRef<number | null>(null);
  const recordingDurationRef = useRef(0);
  const retryingMessagesRef = useRef(new Set<string>());
  const typingActiveRef = useRef(false);
  const typingStartTimerRef = useRef<number | null>(null);
  const typingStopTimerRef = useRef<number | null>(null);
  const typingHeartbeatRef = useRef<number | null>(null);
  const typingIndicatorTimerRef = useRef<number | null>(null);

  const loadConversation = useCallback(async () => {
    if (!userId) return;
    const token = sessionStorage.getItem("drivenow_access_token");
    if (!token) {
      setError("Sign in to open this booking conversation.");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/bookings/${bookingId}`, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json() as ApiResponse;
      if (!response.ok || !result.success || !result.data?.conversation) {
        throw new Error(result.message ?? "Unable to load this conversation.");
      }
      const savedMessages = result.data.conversation.messages.map((message) => ({
        ...message,
        sendState: "sent" as const,
      }));
      const queuedMessages = await listQueuedMessages(userId, result.data.conversation.conversationId);
      const loadedClientMessageIds = new Set(savedMessages.map((message) => message.clientMessageId).filter(Boolean));
      const unsentQueuedMessages: QueuedChatMessage[] = [];
      for (const queuedMessage of queuedMessages) {
        if (loadedClientMessageIds.has(queuedMessage.clientMessageId)) {
          await removeQueuedMessage(queuedMessage.key);
        } else {
          unsentQueuedMessages.push(queuedMessage);
        }
      }
      setMessages([
        ...savedMessages,
        ...unsentQueuedMessages.map((message) => ({
          id: message.clientMessageId,
          clientMessageId: message.clientMessageId,
          senderId: userId,
          senderName: user?.fullName ?? "You",
          body: message.body,
          createdAt: message.createdAt,
          deliveredAt: null,
          readAt: null,
          sendState: message.status,
        })),
      ]);
      setConversation(result.data.conversation);
      setError("");
      setOutboxError("");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to load this conversation.");
    } finally {
      setLoading(false);
    }
  }, [bookingId, user?.fullName, userId]);

  useEffect(() => {
    if (isAuthLoading || !userId) return;
    void Promise.resolve().then(loadConversation);
  }, [isAuthLoading, loadConversation, userId]);

  const retryQueuedMessage = useCallback(async (queuedMessage: QueuedChatMessage) => {
    const socket = socketRef.current;
    if (!socket?.connected || !joinedConversationRef.current) {
      setSending(false);
      setError("Message is saved on this device and will retry when you reconnect.");
      return;
    }
    if (retryingMessagesRef.current.has(queuedMessage.clientMessageId)) return;

    retryingMessagesRef.current.add(queuedMessage.clientMessageId);
    try {
      await updateQueuedMessageStatus(queuedMessage.key, "pending");
      setMessages((current) => current.map((message) => message.clientMessageId === queuedMessage.clientMessageId
        ? { ...message, sendState: "pending" }
        : message));
    } catch (caughtError) {
      retryingMessagesRef.current.delete(queuedMessage.clientMessageId);
      setSending(false);
      setOutboxError(caughtError instanceof Error ? caughtError.message : "Could not update the local message queue.");
      return;
    }

    socket.timeout(12_000).emit(
      "chat:send",
      {
        conversationId: queuedMessage.conversationId,
        clientMessageId: queuedMessage.clientMessageId,
        body: queuedMessage.body,
      },
      async (timeoutError: Error | null, result?: SocketAck) => {
        retryingMessagesRef.current.delete(queuedMessage.clientMessageId);
        if (timeoutError || !result) {
          setError("Message is queued and will retry when the connection is restored.");
          setSending(false);
          return;
        }
        if (!result.success || !result.data?.message) {
          const failure = result.message ?? "The message could not be sent.";
          try {
            await updateQueuedMessageStatus(queuedMessage.key, "failed");
            setMessages((current) => current.map((message) => message.clientMessageId === queuedMessage.clientMessageId
              ? { ...message, sendState: "failed" }
              : message));
          } catch (caughtError) {
            setOutboxError(caughtError instanceof Error ? caughtError.message : "Could not save the message retry state.");
          }
          setError(failure);
          setSending(false);
          return;
        }

        const sentMessage = { ...result.data.message, sendState: "sent" as const };
        setMessages((current) => upsertMessage(current, sentMessage));
        setMessageText((current) => current.trim() === queuedMessage.body ? "" : current);
        setSending(false);
        setError("");
        try {
          await removeQueuedMessage(queuedMessage.key);
          setOutboxError("");
        } catch (caughtError) {
          setOutboxError(caughtError instanceof Error
            ? `Message sent, but local queue cleanup failed: ${caughtError.message}`
            : "Message sent, but local queue cleanup failed.");
        }
      },
    );
  }, []);

  useEffect(() => {
    const conversationId = conversation?.conversationId;
    const bookingStatus = conversation?.bookingStatus;
    if (!conversationId || bookingStatus !== "confirmed" || !userId || (role !== "customer" && role !== "dealer")) return;
    const token = sessionStorage.getItem("drivenow_access_token");
    if (!token) return;

    const socket = io(SOCKET_URL, { auth: { token }, transports: ["websocket", "polling"] });
    socketRef.current = socket;

    socket.on("connect", () => {
      joinedConversationRef.current = false;
      setConnected(false);
      socket.emit(
        "chat:join",
        { conversationId },
        async (result: SocketAck) => {
          if (!result.success) {
            setError(result.message ?? "Unable to join this conversation.");
            setConnected(false);
            return;
          }
          joinedConversationRef.current = true;
          setConnected(true);
          setError("");
          if (result.presence) setPresence(result.presence);
          try {
            const queuedMessages = await listQueuedMessages(userId, conversationId);
            for (const queuedMessage of queuedMessages.filter((message) => message.status === "pending")) {
              await retryQueuedMessage(queuedMessage);
            }
          } catch (caughtError) {
            setOutboxError(caughtError instanceof Error ? caughtError.message : "Could not load queued messages.");
          }
        },
      );
    });
    socket.on("connect_error", (caughtError: Error) => {
      setConnected(false);
      setError(caughtError.message || "Live chat connection failed.");
    });
    socket.on("disconnect", () => {
      joinedConversationRef.current = false;
      setConnected(false);
      typingActiveRef.current = false;
      if (typingStartTimerRef.current !== null) window.clearTimeout(typingStartTimerRef.current);
      if (typingStopTimerRef.current !== null) window.clearTimeout(typingStopTimerRef.current);
      if (typingHeartbeatRef.current !== null) window.clearInterval(typingHeartbeatRef.current);
      typingStartTimerRef.current = null;
      typingStopTimerRef.current = null;
      typingHeartbeatRef.current = null;
      setIsOtherTyping(false);
    });
    socket.on("chat:message", (incoming: ChatMessage) => {
      setMessages((current) => upsertMessage(current, { ...incoming, sendState: "sent" }));
      if (incoming.senderId !== userId && isVoiceMessage(incoming.body)) {
        const audio = new Audio(incoming.body);
        audio.preload = "auto";
        void audio.play().catch(() => undefined);
      }
      if (incoming.senderId !== userId) {
        socket.emit("chat:delivered", { conversationId, messageId: incoming.id });
        socket.emit("chat:read", { conversationId });
      }
    });
    socket.on("chat:typing", (input: { userId: string; isTyping: boolean }) => {
      if (input.userId === userId) return;
      setIsOtherTyping(input.isTyping);
      if (typingIndicatorTimerRef.current !== null) window.clearTimeout(typingIndicatorTimerRef.current);
      if (input.isTyping) {
        typingIndicatorTimerRef.current = window.setTimeout(() => setIsOtherTyping(false), 4_000);
      }
    });
    const otherPartyId = role === "customer" ? conversation?.dealerUserId : conversation?.customerId;
    socket.on("presence:update", (update: PresenceUpdate) => {
      if (update.userId === otherPartyId) setPresence(update);
    });
    socket.on("presence:privacy", (input: { userId: string }) => {
      if (input.userId === otherPartyId) setPresence(null);
    });
    socket.on("chat:receipt", (receipt: ChatReceipt) => {
      setMessages((current) => current.map((message) => message.id === receipt.id
        ? { ...message, deliveredAt: receipt.deliveredAt, readAt: receipt.readAt }
        : message));
    });

    return () => {
      if (typingStartTimerRef.current !== null) window.clearTimeout(typingStartTimerRef.current);
      if (typingStopTimerRef.current !== null) window.clearTimeout(typingStopTimerRef.current);
      if (typingHeartbeatRef.current !== null) window.clearInterval(typingHeartbeatRef.current);
      if (typingIndicatorTimerRef.current !== null) window.clearTimeout(typingIndicatorTimerRef.current);
      joinedConversationRef.current = false;
      socket.disconnect();
      socketRef.current = null;
    };
  }, [conversation?.conversationId, conversation?.bookingStatus, conversation?.customerId, conversation?.dealerUserId, retryQueuedMessage, role, userId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function stopTyping() {
    if (typingStartTimerRef.current !== null) window.clearTimeout(typingStartTimerRef.current);
    if (typingStopTimerRef.current !== null) window.clearTimeout(typingStopTimerRef.current);
    if (typingHeartbeatRef.current !== null) window.clearInterval(typingHeartbeatRef.current);
    typingStartTimerRef.current = null;
    typingStopTimerRef.current = null;
    typingHeartbeatRef.current = null;
    if (typingActiveRef.current && conversation) {
      socketRef.current?.emit("chat:typing", {
        conversationId: conversation.conversationId,
        isTyping: false,
      });
    }
    typingActiveRef.current = false;
  }

  function handleMessageTextChange(value: string) {
    setMessageText(value);
    if (!value.trim() || !conversation || !connected) {
      stopTyping();
      return;
    }

    if (typingStopTimerRef.current !== null) window.clearTimeout(typingStopTimerRef.current);
    if (!typingActiveRef.current && typingStartTimerRef.current === null) {
      typingStartTimerRef.current = window.setTimeout(() => {
        typingStartTimerRef.current = null;
        const socket = socketRef.current;
        if (!socket?.connected) return;
        typingActiveRef.current = true;
        socket.emit("chat:typing", { conversationId: conversation.conversationId, isTyping: true });
        typingHeartbeatRef.current = window.setInterval(() => {
          socket.emit("chat:typing", { conversationId: conversation.conversationId, isTyping: true });
        }, 2_000);
      }, 250);
    }
    typingStopTimerRef.current = window.setTimeout(stopTyping, 1_500);
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = messageText.trim();
    if (!body || !conversation || !userId || sending || isCancelled) return;

    const queuedDuplicate = messages.find((message) => message.body === body
      && message.sendState === "pending"
      && message.clientMessageId);
    if (queuedDuplicate) {
      let queuedMessages: QueuedChatMessage[];
      try {
        queuedMessages = await listQueuedMessages(userId, conversation.conversationId);
      } catch (caughtError) {
        setOutboxError(caughtError instanceof Error ? caughtError.message : "Could not read the local message queue.");
        return;
      }
      const queued = queuedMessages.find((message) => message.clientMessageId === queuedDuplicate.clientMessageId);
      if (queued) {
        setSending(true);
        void retryQueuedMessage(queued);
        return;
      }
    }

    setSending(true);
    setError("");
    stopTyping();

    const clientMessageId = crypto.randomUUID();
    const queuedMessage: QueuedChatMessage = {
      key: `${userId}:${clientMessageId}`,
      userId,
      conversationId: conversation.conversationId,
      clientMessageId,
      body,
      createdAt: new Date().toISOString(),
      status: "pending",
    };
    try {
      await saveQueuedMessage(queuedMessage);
      setOutboxError("");
      setMessages((current) => upsertMessage(current, {
        id: clientMessageId,
        clientMessageId,
        senderId: userId,
        senderName: user.fullName,
        body,
        createdAt: queuedMessage.createdAt,
        deliveredAt: null,
        readAt: null,
        sendState: "pending",
      }));
      if (socketRef.current?.connected) {
        void retryQueuedMessage(queuedMessage);
      } else {
        setSending(false);
        setError("Message saved on this device and will send when you reconnect.");
      }
    } catch (caughtError) {
      setSending(false);
      setOutboxError(caughtError instanceof Error
        ? `Message was not sent because it could not be saved locally: ${caughtError.message}`
        : "Message was not sent because it could not be saved locally.");
    }
  }

  async function sendVoiceMessage(blob: Blob, durationSeconds: number) {
    if (!conversation || !userId || isCancelled) return;

    const body = await blobToDataUrl(blob);
    const clientMessageId = crypto.randomUUID();
    const queuedMessage: QueuedChatMessage = {
      key: `${userId}:${clientMessageId}`,
      userId,
      conversationId: conversation.conversationId,
      clientMessageId,
      body,
      createdAt: new Date().toISOString(),
      status: "pending",
    };

    setSending(true);
    setError("");
    stopTyping();

    try {
      await saveQueuedMessage(queuedMessage);
      setMessages((current) => upsertMessage(current, {
        id: clientMessageId,
        clientMessageId,
        senderId: userId,
        senderName: user.fullName,
        body,
        createdAt: queuedMessage.createdAt,
        deliveredAt: null,
        readAt: null,
        sendState: "pending",
      }));
      if (socketRef.current?.connected) {
        void retryQueuedMessage(queuedMessage);
      } else {
        setSending(false);
        setError("Voice note saved on this device and will send when you reconnect.");
      }
      setOutboxError("");
    } catch (caughtError) {
      setSending(false);
      setOutboxError(caughtError instanceof Error
        ? `Voice note could not be saved locally: ${caughtError.message}`
        : "Voice note could not be saved locally.");
    }

    if (durationSeconds > 0) {
      setRecordingSeconds(durationSeconds);
    }
  }

  async function startRecordingVoice() {
    if (!conversation || !navigator.mediaDevices?.getUserMedia || isCancelled) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const audioChunks: Blob[] = [];
      audioStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      recordingDurationRef.current = 0;
      setRecordingSeconds(0);
      setIsRecording(true);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunks.push(event.data);
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: recorder.mimeType || "audio/webm" });
        audioStreamRef.current?.getTracks().forEach((track) => track.stop());
        audioStreamRef.current = null;
        mediaRecorderRef.current = null;
        setIsRecording(false);
        setRecordingSeconds(0);
        if (audioBlob.size > 0) {
          await sendVoiceMessage(audioBlob, recordingDurationRef.current);
        }
      };

      recorder.start();
      if (recordingTimerRef.current !== null) window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = window.setInterval(() => {
        recordingDurationRef.current += 1;
        setRecordingSeconds(recordingDurationRef.current);
      }, 1000);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Microphone access is unavailable.");
    }
  }

  function stopRecordingVoice() {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;
    if (recordingTimerRef.current !== null) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    recorder.stop();
  }

  async function reportConversation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = sessionStorage.getItem("drivenow_access_token");
    if (!token || !conversation) return;

    setReporting(true);
    setReportMessage("");
    try {
      const response = await fetch(`${API_URL}/${conversation.conversationId}/report`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason: reportReason }),
      });
      const result = await response.json() as { success: boolean; message?: string };
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "Unable to report this conversation.");
      }
      setReportMessage(result.message ?? "Your report was sent to support.");
      setReportOpen(false);
      setReportReason("");
      setConversation((current) => current
        ? { ...current, reportedAt: current.reportedAt ?? new Date().toISOString() }
        : current);
    } catch (caughtError) {
      setReportMessage(caughtError instanceof Error ? caughtError.message : "Unable to report this conversation.");
    } finally {
      setReporting(false);
    }
  }

  if (isAuthLoading || loading) {
    return <p role="status" className="rounded-2xl bg-[#fffdf9] p-8 text-center text-sm text-[#68756f]">Opening your booking chat…</p>;
  }

  if (error && !conversation) {
    return (
      <div className="rounded-2xl border border-[#e2ded5] bg-[#fffdf9] p-8 text-center">
        <p role="alert" className="text-sm text-red-800">{error}</p>
        <Link href="/dashboard/bookings" className="mt-5 inline-flex rounded-xl bg-[#123b35] px-5 py-3 text-sm font-bold text-white">
          Back to bookings
        </Link>
      </div>
    );
  }

  if (!conversation || !user || (role !== "customer" && role !== "dealer")) return null;

  const isCustomer = role === "customer";
  const otherParty = isCustomer ? conversation.dealerName : conversation.customerName;
  const isCancelled = conversation.bookingStatus === "cancelled";

  return (
    <section className="overflow-hidden rounded-3xl border border-[#e2ded5] bg-[#fffdf9] shadow-sm">
      <header className="border-b border-[#e9e5dc] p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <div className="relative h-16 w-20 shrink-0 overflow-hidden rounded-xl bg-[#e9eee7]">
              {conversation.imageUrls[0] && (
                <Image src={conversation.imageUrls[0]} alt="" fill unoptimized className="object-cover" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#c28d27]">Booking conversation</p>
              <h1 className="mt-1 truncate text-lg font-bold text-[#123b35]">
                {conversation.year} {conversation.make} {conversation.model}
              </h1>
              <p className="mt-1 text-xs text-[#68756f]">
                {conversation.startDate} – {conversation.endDate}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${isCancelled ? "bg-[#f9e5df] text-[#943d22]" : "bg-[#e6f2e8] text-[#245c4c]"}`}>
              {conversation.bookingStatus}
            </span>
            <Link href={`/vehicles/${conversation.vehicleId}`} className="rounded-xl border border-[#d6dcd5] px-3 py-2 text-xs font-semibold text-[#245c4c] transition hover:bg-[#f4f1eb]">
              View car
            </Link>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#e9e5dc] pt-4 text-sm">
          <div>
            <p className="text-[#68756f]">Chatting with <span className="font-semibold text-[#123b35]">{otherParty}</span></p>
            <p className="mt-1 text-xs text-[#87928c]">
              {presence?.online
                ? "Online"
                : presence?.lastSeenAt
                  ? `Last seen ${new Date(presence.lastSeenAt).toLocaleString()}`
                  : "Presence hidden"}
            </p>
          </div>
          <span className={`inline-flex items-center gap-2 text-xs font-semibold ${connected ? "text-[#245c4c]" : "text-[#87928c]"}`}>
            <span className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-500" : "bg-[#c6c8c0]"}`} />
            {isCancelled ? "History only" : connected ? "Live" : "Connecting…"}
          </span>
        </div>
      </header>

      {isCancelled && (
        <p className="border-b border-[#e9e5dc] bg-[#f9e5df]/60 px-5 py-3 text-sm text-[#943d22]">
          This booking was cancelled. You can read the chat history, but can no longer send messages.
        </p>
      )}
      {conversation.reportedAt && (
        <p className="border-b border-[#e9e5dc] bg-[#fff3d6] px-5 py-3 text-sm text-[#76571b]">
          This conversation has been reported to DriveNow support.
        </p>
      )}

      <div className="flex h-[min(60vh,36rem)] flex-col gap-3 overflow-y-auto bg-[#f8f6f1] p-4 sm:p-6" aria-live="polite">
        {messages.length === 0 ? (
          <div className="m-auto max-w-sm text-center">
            <p className="font-semibold text-[#123b35]">Start the conversation</p>
            <p className="mt-2 text-sm leading-6 text-[#68756f]">Discuss pickup details, questions, or anything needed to complete this rental.</p>
          </div>
        ) : messages.map((message) => {
          const mine = message.senderId === user.id;
          const voiceMessage = isVoiceMessage(message.body);
          return (
            <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <article className={`max-w-[85%] rounded-2xl px-4 py-3 sm:max-w-[70%] ${mine ? "rounded-br-md bg-[#123b35] text-white" : "rounded-bl-md border border-[#e2ded5] bg-white text-[#18211f]"}`}>
                <p className={`mb-1 text-xs font-bold ${mine ? "text-white/75" : "text-[#245c4c]"}`}>
                  {message.senderName}
                </p>
                {voiceMessage ? (
                  <div className="space-y-2">
                    <span className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${mine ? "bg-white/12 text-white/80" : "bg-[#edf3f0] text-[#245c4c]"}`}>
                      🎙 Voice note
                    </span>
                    <audio controls src={message.body} className="w-full max-w-xs" />
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap break-words text-sm leading-6">{message.body}</p>
                )}
                <div className={`mt-2 flex items-center justify-end gap-2 text-[10px] ${mine ? "text-white/70" : "text-[#87928c]"}`}>
                  <time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleString()}</time>
                  {mine && (
                    <span aria-label={
                      message.sendState === "failed"
                        ? "Failed to send"
                        : message.sendState === "pending"
                          ? "Pending"
                          : message.readAt
                            ? "Seen"
                            : message.deliveredAt
                              ? "Delivered"
                              : "Sent"
                    }>
                      {message.sendState === "failed"
                        ? "Failed"
                        : message.sendState === "pending"
                          ? "Pending"
                          : message.readAt
                            ? "✓✓ Seen"
                            : message.deliveredAt
                              ? "✓✓ Delivered"
                              : "✓ Sent"}
                    </span>
                  )}
                  {mine && message.sendState !== "sent" && !isCancelled && (
                    <button
                      type="button"
                      className="font-bold underline"
                      onClick={async () => {
                        if (!userId || !conversation) return;
                        try {
                          const queued = await listQueuedMessages(userId, conversation.conversationId);
                          const failed = queued.find((item) => item.clientMessageId === message.clientMessageId);
                          if (!failed) {
                            setOutboxError("This message is no longer in the local retry queue.");
                            return;
                          }
                          setSending(true);
                          void retryQueuedMessage(failed);
                        } catch (caughtError) {
                          setOutboxError(caughtError instanceof Error
                            ? caughtError.message
                            : "Could not load the local message retry queue.");
                        }
                      }}
                    >
                      Retry
                    </button>
                  )}
                </div>
              </article>
            </div>
          );
        })}
        {isOtherTyping && (
          <p role="status" className="self-start rounded-xl border border-[#e2ded5] bg-white px-3 py-2 text-xs text-[#68756f]">
            {otherParty} is typing…
          </p>
        )}
        <div ref={bottomRef} />
      </div>

      {error && <p role="alert" className="border-t border-red-100 bg-red-50 px-5 py-3 text-sm text-red-800">{error}</p>}
      {outboxError && <p role="alert" className="border-t border-amber-100 bg-amber-50 px-5 py-3 text-sm text-amber-900">{outboxError}</p>}
      <form onSubmit={sendMessage} className="flex items-end gap-3 border-t border-[#e9e5dc] p-4 sm:p-5">
        <label className="sr-only" htmlFor="chat-message">Write a message</label>
        <textarea
          id="chat-message"
          value={messageText}
          onChange={(event) => handleMessageTextChange(event.target.value)}
          onBlur={stopTyping}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          maxLength={4000}
          rows={2}
          disabled={sending || isCancelled}
          placeholder={isCancelled ? "Messaging is closed for this cancelled booking" : connected ? "Write a message…" : "Write a message — it will queue until you reconnect"}
          className="min-h-12 flex-1 resize-y rounded-xl border border-[#d6dcd5] bg-white px-4 py-3 text-sm text-[#18211f] outline-none transition focus:border-[#245c4c] focus:ring-2 focus:ring-[#245c4c]/15 disabled:bg-[#f4f1eb] disabled:text-[#87928c]"
        />
        <button
          type="button"
          onClick={isRecording ? stopRecordingVoice : startRecordingVoice}
          disabled={sending || isCancelled}
          className={`shrink-0 rounded-xl px-4 py-3 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${isRecording ? "bg-[#943d22] hover:bg-[#7f3627]" : "bg-[#245c4c] hover:bg-[#1a413a]"}`}
          aria-label={isRecording ? "Stop recording voice note" : "Record a voice note"}
        >
          {isRecording ? `Stop ${recordingSeconds}s` : "Voice"}
        </button>
        <button
          type="submit"
          disabled={!messageText.trim() || sending || isCancelled}
          className="shrink-0 rounded-xl bg-[#123b35] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#245c4c] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {sending ? (connected ? "Sending…" : "Queued…") : "Send"}
        </button>
      </form>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e9e5dc] px-4 py-3 sm:px-5">
        <p className="text-xs text-[#87928c]">Messages are saved with this booking.</p>
        {conversation.reportedAt ? (
          <span className="text-xs font-semibold text-[#76571b]">Reported to support</span>
        ) : (
          <button type="button" onClick={() => setReportOpen(true)} className="text-xs font-semibold text-[#68756f] underline hover:text-[#943d22]">
            Report a problem
          </button>
        )}
      </footer>

      {reportMessage && <p role="status" className="border-t border-[#e9e5dc] px-5 py-3 text-sm text-[#245c4c]">{reportMessage}</p>}
      {reportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setReportOpen(false); }}>
          <form onSubmit={reportConversation} role="dialog" aria-modal="true" aria-labelledby="report-chat-title" className="w-full max-w-lg rounded-2xl bg-[#fffdf9] p-6 shadow-2xl">
            <h2 id="report-chat-title" className="text-xl font-bold text-[#123b35]">Report this conversation</h2>
            <p className="mt-2 text-sm leading-6 text-[#68756f]">Only DriveNow support can review a reported chat. Your report and support access are recorded.</p>
            <label htmlFor="report-reason" className="mt-5 block text-sm font-semibold text-[#123b35]">What happened?</label>
            <textarea
              id="report-reason"
              required
              minLength={10}
              maxLength={1000}
              rows={4}
              value={reportReason}
              onChange={(event) => setReportReason(event.target.value)}
              className="mt-2 block w-full rounded-xl border border-[#d6dcd5] bg-white px-4 py-3 text-sm outline-none focus:border-[#245c4c] focus:ring-2 focus:ring-[#245c4c]/15"
            />
            {reportMessage && <p role="alert" className="mt-3 text-sm text-red-800">{reportMessage}</p>}
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={() => setReportOpen(false)} className="rounded-xl border border-[#d6dcd5] px-4 py-2.5 text-sm font-semibold text-[#68756f]">Cancel</button>
              <button type="submit" disabled={reporting} className="rounded-xl bg-[#943d22] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">
                {reporting ? "Submitting…" : "Send report"}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
