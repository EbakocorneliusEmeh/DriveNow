"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const API_URL = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api"}/bookings`;

type CustomerBooking = {
  id: string;
  conversationId: string | null;
  vehicleId: string;
  make: string;
  model: string;
  year: number;
  startDate: string;
  endDate: string;
  totalDays: number;
  estimatedTotal: number;
  status: "pending" | "confirmed" | "declined" | "cancelled";
  createdAt: string;
  businessName: string;
};

type BookingFilter = "all" | CustomerBooking["status"];

export default function CustomerBookings() {
  const [bookings, setBookings] = useState<CustomerBooking[]>([]);
  const [filter, setFilter] = useState<BookingFilter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cancellingId, setCancellingId] = useState("");

  const loadBookings = useCallback(async () => {
    const token = sessionStorage.getItem("drivenow_access_token");
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/mine`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json() as {
        success: boolean;
        message?: string;
        data?: { bookings: CustomerBooking[] };
      };
      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.message ?? "Unable to load your rental requests.");
      }
      setBookings(result.data.bookings);
      setError("");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to load your rental requests.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(loadBookings);
  }, [loadBookings]);

  async function cancelBooking(booking: CustomerBooking) {
    if (!window.confirm(`Cancel your ${booking.year} ${booking.make} ${booking.model} booking request?`)) {
      return;
    }

    const token = sessionStorage.getItem("drivenow_access_token");
    if (!token) {
      setError("Sign in again to cancel this booking.");
      return;
    }

    setCancellingId(booking.id);
    setError("");
    try {
      const response = await fetch(`${API_URL}/${booking.id}/cancel`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      const result = await response.json() as { success: boolean; message?: string };
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "Unable to cancel this booking.");
      }
      await loadBookings();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to cancel this booking.");
    } finally {
      setCancellingId("");
    }
  }

  const filters: { value: BookingFilter; label: string }[] = [
    { value: "all", label: "All requests" },
    { value: "pending", label: "Waiting for dealer" },
    { value: "confirmed", label: "Confirmed" },
    { value: "declined", label: "Declined" },
    { value: "cancelled", label: "Cancelled" },
  ];
  const filteredBookings = bookings.filter((booking) => filter === "all" || booking.status === filter);
  const pendingCount = bookings.filter((booking) => booking.status === "pending").length;
  const confirmedCount = bookings.filter((booking) => booking.status === "confirmed").length;

  return (
    <section id="bookings">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.22em] text-[#c28d27]">Your trips</p>
          <h1 className="text-3xl font-semibold tracking-[-0.05em] text-[#123b35] sm:text-4xl">My bookings</h1>
          <p className="mt-2 text-sm text-[#68756f]">Keep track of your rental requests and dealer responses.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/messages" className="inline-flex items-center justify-center rounded-xl border border-[#d6dcd5] bg-[#fffdf9] px-4 py-3 text-sm font-semibold text-[#245c4c] transition hover:bg-[#e9eee7]">
            Messages
          </Link>
          <Link href="/dashboard#vehicles" className="inline-flex items-center justify-center rounded-xl bg-[#123b35] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#245c4c]">
            Find a car
          </Link>
        </div>
      </div>

      <div className="mt-7 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-[#e2ded5] bg-[#fffdf9] p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#87928c]">Total requests</p>
          <p className="mt-2 text-2xl font-bold text-[#123b35]">{bookings.length}</p>
        </div>
        <div className="rounded-2xl border border-[#e2ded5] bg-[#fffdf9] p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#87928c]">Awaiting response</p>
          <p className="mt-2 text-2xl font-bold text-[#76571b]">{pendingCount}</p>
        </div>
        <div className="rounded-2xl border border-[#e2ded5] bg-[#fffdf9] p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#87928c]">Confirmed</p>
          <p className="mt-2 text-2xl font-bold text-[#245c4c]">{confirmedCount}</p>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" aria-label="Filter bookings">
          {filters.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              aria-pressed={filter === value}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${filter === value ? "bg-[#123b35] text-white" : "border border-[#d6dcd5] bg-[#fffdf9] text-[#68756f] hover:bg-[#e9eee7]"}`}
            >
              {label}
              {value === "pending" && pendingCount > 0 && <span className="ml-2 rounded-full bg-white/20 px-2 py-0.5 text-xs">{pendingCount}</span>}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            void loadBookings();
          }}
          disabled={loading}
          className="rounded-xl border border-[#d6dcd5] bg-[#fffdf9] px-4 py-2.5 text-sm font-semibold text-[#245c4c] transition hover:bg-[#e9eee7] disabled:opacity-60"
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {error && (
        <div role="alert" className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-red-50 p-4 text-sm text-red-800">
          <span>{error}</span>
          <button type="button" onClick={() => { setLoading(true); void loadBookings(); }} className="font-bold underline">Try again</button>
        </div>
      )}
      {loading ? (
        <p role="status" className="mt-5 rounded-2xl bg-[#fffdf9] p-8 text-center text-sm text-[#68756f]">Loading your rental requests…</p>
      ) : filteredBookings.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-[#e2ded5] bg-[#fffdf9] px-6 py-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#e9eee7] text-2xl text-[#245c4c]" aria-hidden="true">◷</div>
          <h2 className="mt-4 text-lg font-semibold text-[#123b35]">{bookings.length ? "No requests in this category" : "Your rental requests will appear here"}</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#68756f]">
            {bookings.length ? "Choose another status filter to see your requests." : "Choose a car, select your dates, and send a request. You can follow the dealer’s response here."}
          </p>
          {!bookings.length && (
            <Link href="/dashboard#vehicles" className="mt-5 inline-flex rounded-xl bg-[#123b35] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#245c4c]">
              Browse available cars
            </Link>
          )}
        </div>
      ) : (
        <div className="mt-5 grid gap-4">
          {filteredBookings.map((booking) => (
            <article key={booking.id} className="rounded-2xl border border-[#e2ded5] bg-[#fffdf9] p-5">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <Link href={`/vehicles/${booking.vehicleId}`} className="font-semibold text-[#123b35] hover:underline">
                    {booking.year} {booking.make} {booking.model}
                  </Link>
                  <p className="mt-1 text-xs text-[#68756f]">{booking.businessName}</p>
                  <p className="mt-4 text-sm text-[#68756f]">
                    {booking.startDate} – {booking.endDate} · {booking.totalDays} {booking.totalDays === 1 ? "day" : "days"}
                  </p>
                </div>
                <div className="sm:text-right">
                  <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize ${booking.status === "pending" ? "bg-[#fff3d6] text-[#76571b]" : booking.status === "confirmed" ? "bg-[#e6f2e8] text-[#245c4c]" : "bg-[#f9e5df] text-[#943d22]"}`}>
                    {booking.status === "pending" ? "Waiting for dealer" : booking.status}
                  </span>
                  <p className="mt-3 text-sm font-bold text-[#123b35]">{booking.estimatedTotal.toLocaleString()} FCFA estimated</p>
                  <p className="mt-1 text-xs text-[#87928c]">Additional fees may apply</p>
                </div>
              </div>
              <p className="mt-4 border-t border-[#e9e5dc] pt-3 text-xs leading-5 text-[#87928c]">
                {booking.status === "pending"
                  ? "Your request has been sent. The dealer will review it and respond."
                  : booking.status === "confirmed"
                    ? "The dealer confirmed your request. Contact them to coordinate pickup and final rental details."
                    : booking.status === "declined"
                      ? "The dealer could not accept this request. Browse other cars or try different dates."
                      : "This booking request has been cancelled."}
              </p>
              {booking.conversationId && (
                <Link
                  href={`/dashboard/bookings/${booking.id}/chat`}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#123b35] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#245c4c]"
                >
                  {booking.status === "cancelled" ? "View chat history" : "Message dealer"}
                  <span className="text-white/70" aria-hidden="true">→</span>
                </Link>
              )}
              {(booking.status === "pending" || booking.status === "confirmed") && (
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    disabled={cancellingId === booking.id}
                    onClick={() => void cancelBooking(booking)}
                    className="rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-60"
                  >
                    {cancellingId === booking.id ? "Cancelling…" : "Cancel booking"}
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
