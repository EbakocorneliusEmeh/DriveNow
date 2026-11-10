"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { io, type Socket } from "socket.io-client";
import { useAuth } from "@/hooks/useAuth";

const API_URL = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api"}/chat`;
const SOCKET_URL = new URL(API_URL).origin;

type ChatMessage = {
  id: string;
  senderId: string;
  senderName: string;
  body: string;
  createdAt: string;
};

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
};

export default function BookingChat({ bookingId }: { bookingId: string }) {
  const { user, role, isLoading: isAuthLoading } = useAuth();
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
  const socketRef = useRef<Socket | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const loadConversation = useCallback(async () => {
    const token = sessionStorage.getItem("drivenow_access_token");
    if (!token) {
      setError("Sign in to open this booking conversation.");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/bookings/${bookingId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json() as ApiResponse;
      if (!response.ok || !result.success || !result.data?.conversation) {
        throw new Error(result.message ?? "Unable to load this conversation.");
      }
      setConversation(result.data.conversation);
      setMessages(result.data.conversation.messages);
      setError("");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to load this conversation.");
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    void Promise.resolve().then(loadConversation);
  }, [loadConversation]);

  useEffect(() => {
    const conversationId = conversation?.conversationId;
    const bookingStatus = conversation?.bookingStatus;
    const userId = user?.id;
    if (!conversationId || bookingStatus !== "confirmed" || !userId || (role !== "customer" && role !== "dealer")) return;
    const token = sessionStorage.getItem("drivenow_access_token");
    if (!token) return;

    const socket = io(SOCKET_URL, { auth: { token }, transports: ["websocket", "polling"] });
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit(
        "chat:join",
        { conversationId },
        (result: SocketAck) => {
          if (!result.success) {
            setError(result.message ?? "Unable to join this conversation.");
            return;
          }
          setConnected(true);
          setError("");
        },
      );
    });
    socket.on("connect_error", (caughtError: Error) => {
      setConnected(false);
      setError(caughtError.message || "Live chat connection failed.");
    });
    socket.on("disconnect", () => setConnected(false));
    socket.on("chat:message", (incoming: ChatMessage) => {
      setMessages((current) => current.some((message) => message.id === incoming.id)
        ? current
        : [...current, incoming]);
      if (incoming.senderId !== userId) {
        socket.emit("chat:read", { conversationId });
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [conversation?.conversationId, conversation?.bookingStatus, role, user?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = messageText.trim();
    const socket = socketRef.current;
    if (!body || !socket || !connected || sending) return;

    setSending(true);
    setError("");
    socket.emit(
      "chat:send",
      { conversationId: conversation?.conversationId, body },
      (result: { success: boolean; message?: string }) => {
        if (!result.success) {
          setError(result.message ?? "Unable to send your message.");
        } else {
          setMessageText("");
        }
        setSending(false);
      },
    );
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
          <p className="text-[#68756f]">Chatting with <span className="font-semibold text-[#123b35]">{otherParty}</span></p>
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
          return (
            <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <article className={`max-w-[85%] rounded-2xl px-4 py-3 sm:max-w-[70%] ${mine ? "rounded-br-md bg-[#123b35] text-white" : "rounded-bl-md border border-[#e2ded5] bg-white text-[#18211f]"}`}>
                <p className={`mb-1 text-xs font-bold ${mine ? "text-white/75" : "text-[#245c4c]"}`}>
                  {message.senderName}
                </p>
                <p className="whitespace-pre-wrap break-words text-sm leading-6">{message.body}</p>
                <time dateTime={message.createdAt} className={`mt-2 block text-right text-[10px] ${mine ? "text-white/70" : "text-[#87928c]"}`}>
                  {new Date(message.createdAt).toLocaleString()}
                </time>
              </article>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {error && <p role="alert" className="border-t border-red-100 bg-red-50 px-5 py-3 text-sm text-red-800">{error}</p>}
      <form onSubmit={sendMessage} className="flex items-end gap-3 border-t border-[#e9e5dc] p-4 sm:p-5">
        <label className="sr-only" htmlFor="chat-message">Write a message</label>
        <textarea
          id="chat-message"
          value={messageText}
          onChange={(event) => setMessageText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          maxLength={4000}
          rows={2}
          disabled={!connected || isCancelled}
          placeholder={isCancelled ? "Messaging is closed for this cancelled booking" : "Write a message…"}
          className="min-h-12 flex-1 resize-y rounded-xl border border-[#d6dcd5] bg-white px-4 py-3 text-sm text-[#18211f] outline-none transition focus:border-[#245c4c] focus:ring-2 focus:ring-[#245c4c]/15 disabled:bg-[#f4f1eb] disabled:text-[#87928c]"
        />
        <button
          type="submit"
          disabled={!connected || !messageText.trim() || sending || isCancelled}
          className="shrink-0 rounded-xl bg-[#123b35] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#245c4c] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {sending ? "Sending…" : "Send"}
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
