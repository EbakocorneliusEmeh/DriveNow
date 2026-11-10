"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { io } from "socket.io-client";

const API_URL = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api"}/chat`;
const SOCKET_URL = new URL(API_URL).origin;

type ConversationSummary = {
  conversationId: string;
  bookingId: string;
  bookingStatus: "confirmed" | "cancelled";
  vehicleId: string;
  make: string;
  model: string;
  year: number;
  imageUrls: string[];
  startDate: string;
  endDate: string;
  otherPartyName: string;
  updatedAt: string;
  unreadCount: number;
  lastMessage: {
    body: string;
    createdAt: string;
    senderId: string;
  } | null;
};

type PresenceVisibility = "everyone" | "contacts" | "nobody";

export default function MessagesInbox() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [presenceVisibility, setPresenceVisibility] = useState<PresenceVisibility>("contacts");
  const [isSavingPresence, setIsSavingPresence] = useState(false);
  const [presenceError, setPresenceError] = useState("");

  const loadConversations = useCallback(async () => {
    const token = sessionStorage.getItem("drivenow_access_token");
    if (!token) {
      setLoading(false);
      setError("Sign in again to view your messages.");
      return;
    }

    try {
      const response = await fetch(API_URL, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json() as {
        success: boolean;
        message?: string;
        data?: { conversations: ConversationSummary[] };
      };
      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.message ?? "Unable to load your conversations.");
      }
      setConversations(result.data.conversations);
      setError("");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to load your conversations.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(loadConversations);
  }, [loadConversations]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(async () => {
      const token = sessionStorage.getItem("drivenow_access_token");
      if (!token) return;
      try {
        const response = await fetch(`${API_URL}/presence`, {
          cache: "no-store",
          headers: { Authorization: `Bearer ${token}` },
        });
        const result = await response.json() as {
          success: boolean;
          message?: string;
          data?: { visibility: PresenceVisibility };
        };
        if (!response.ok || !result.success || !result.data) {
          throw new Error(result.message ?? "Unable to load presence settings.");
        }
        if (active) setPresenceVisibility(result.data.visibility);
      } catch (caughtError) {
        if (active) setPresenceError(caughtError instanceof Error
          ? caughtError.message
          : "Unable to load presence settings.");
      }
    });
    return () => {
      active = false;
    };
  }, []);

  async function changePresenceVisibility(visibility: PresenceVisibility) {
    const token = sessionStorage.getItem("drivenow_access_token");
    if (!token) {
      setPresenceError("Sign in again to change presence privacy.");
      return;
    }

    setIsSavingPresence(true);
    setPresenceError("");
    try {
      const response = await fetch(`${API_URL}/presence`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ visibility }),
      });
      const result = await response.json() as {
        success: boolean;
        message?: string;
        data?: { visibility: PresenceVisibility };
      };
      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.message ?? "Unable to update presence privacy.");
      }
      setPresenceVisibility(result.data.visibility);
    } catch (caughtError) {
      setPresenceError(caughtError instanceof Error
        ? caughtError.message
        : "Unable to update presence privacy.");
    } finally {
      setIsSavingPresence(false);
    }
  }

  const unreadTotal = conversations.reduce((total, item) => total + item.unreadCount, 0);

  useEffect(() => {
    let socket: ReturnType<typeof io> | undefined;
    void Promise.resolve().then(() => {
      const token = sessionStorage.getItem("drivenow_access_token");
      if (!token) return;
      socket = io(SOCKET_URL, { auth: { token }, transports: ["websocket", "polling"] });
      socket.on("chat:inbox-updated", () => void loadConversations());
    });
    return () => {
      socket?.disconnect();
    };
  }, [loadConversations]);

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.22em] text-[#c28d27]">Messages</p>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-[-0.05em] text-[#123b35] sm:text-4xl">Your conversations</h1>
            {unreadTotal > 0 && (
              <span className="rounded-full bg-[#d9a441] px-3 py-1 text-xs font-bold text-[#18211f]">
                {unreadTotal} unread
              </span>
            )}
          </div>
          <p className="mt-2 text-sm text-[#68756f]">Messages stay connected to the booking and car they’re about.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs font-semibold text-[#68756f]">
            Presence
            <select
              value={presenceVisibility}
              onChange={(event) => void changePresenceVisibility(event.target.value as PresenceVisibility)}
              disabled={isSavingPresence}
              className="rounded-lg border border-[#d6dcd5] bg-[#fffdf9] px-2.5 py-2 text-sm text-[#123b35] disabled:opacity-60"
            >
              <option value="everyone">Everyone</option>
              <option value="contacts">Contacts only</option>
              <option value="nobody">Nobody</option>
            </select>
          </label>
          <p className="w-full text-right text-xs text-[#87928c]">
            Contacts are people in your approved booking conversations.
          </p>
          <button
            type="button"
            onClick={() => { setLoading(true); void loadConversations(); }}
            disabled={loading}
            className="rounded-xl border border-[#d6dcd5] bg-[#fffdf9] px-4 py-2.5 text-sm font-semibold text-[#245c4c] transition hover:bg-[#e9eee7] disabled:opacity-60"
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      {presenceError && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-xs text-red-800">{presenceError}</p>}
      {loading ? (
        <p role="status" className="mt-6 rounded-2xl bg-[#fffdf9] p-8 text-center text-sm text-[#68756f]">Loading your conversations…</p>
      ) : conversations.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-[#e2ded5] bg-[#fffdf9] px-6 py-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#e9eee7] text-2xl text-[#245c4c]" aria-hidden="true">□</div>
          <h2 className="mt-4 text-lg font-semibold text-[#123b35]">No conversations yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#68756f]">
            When a dealer approves a rental request, you can chat here about the car and your trip.
          </p>
          <Link href="/dashboard/bookings" className="mt-5 inline-flex rounded-xl bg-[#123b35] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#245c4c]">
            View my bookings
          </Link>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {conversations.map((conversation) => (
            <Link
              key={conversation.conversationId}
              href={`/dashboard/bookings/${conversation.bookingId}/chat`}
              className="flex flex-wrap items-center gap-4 rounded-2xl border border-[#e2ded5] bg-[#fffdf9] p-4 transition hover:border-[#c5d3c8] hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d9a441] sm:p-5"
            >
              <div className="relative h-16 w-20 shrink-0 overflow-hidden rounded-xl bg-[#e9eee7]">
                {conversation.imageUrls[0] && (
                  <Image src={conversation.imageUrls[0]} alt="" fill unoptimized className="object-cover" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold text-[#123b35]">{conversation.year} {conversation.make} {conversation.model}</h2>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${conversation.bookingStatus === "confirmed" ? "bg-[#e6f2e8] text-[#245c4c]" : "bg-[#f9e5df] text-[#943d22]"}`}>
                    {conversation.bookingStatus}
                  </span>
                  {conversation.unreadCount > 0 && (
                    <span className="rounded-full bg-[#d9a441] px-2 py-0.5 text-xs font-bold text-[#18211f]">
                      {conversation.unreadCount} new
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-[#68756f]">
                  {conversation.otherPartyName} · {conversation.startDate} – {conversation.endDate}
                </p>
                <p className="mt-2 truncate text-sm text-[#68756f]">
                  {conversation.lastMessage?.body ?? "No messages yet. Start the conversation."}
                </p>
              </div>
              <p className="ml-auto text-xs text-[#87928c]">
                {new Date(conversation.lastMessage?.createdAt ?? conversation.updatedAt).toLocaleDateString()}
              </p>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
