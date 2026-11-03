"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const API_URL = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api"}/bookings`;

type BookingRequest = {
  id: string;
  conversationId: string | null;
  make: string;
  model: string;
  year: number;
  startDate: string;
  endDate: string;
  totalDays: number;
  estimatedTotal: number;
  message: string;
  status: "pending" | "confirmed" | "declined" | "cancelled";
  createdAt: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
};

export default function BookingRequests() {
  const [bookings, setBookings] = useState<BookingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState("");
  const [cancellingId, setCancellingId] = useState("");

  const loadBookings = useCallback(async () => {
    const token = sessionStorage.getItem("drivenow_access_token");
    if (!token) {
      setError("Sign in again to view booking requests.");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/dealer`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json() as {
        success: boolean;
        message?: string;
        data?: { bookings: BookingRequest[] };
      };
      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.message ?? "Unable to load booking requests.");
      }
      setBookings(result.data.bookings);
      setError("");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to load booking requests.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(loadBookings);
  }, [loadBookings]);

  async function updateStatus(bookingId: string, status: "confirmed" | "declined") {
    const token = sessionStorage.getItem("drivenow_access_token");
    if (!token) {
      setError("Sign in again to update this booking request.");
      return;
    }

    setUpdatingId(bookingId);
    setError("");
    try {
      const response = await fetch(`${API_URL}/${bookingId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      });
      const result = await response.json() as { success: boolean; message?: string };
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "Unable to update this booking request.");
      }
      await loadBookings();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to update this booking request.");
    } finally {
      setUpdatingId("");
    }
  }

  async function cancelBooking(booking: BookingRequest) {
    if (!window.confirm(`Cancel the booking request for ${booking.year} ${booking.make} ${booking.model}? The customer will be notified.`)) {
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

  return (
    <section id="booking-requests" className="mt-10">
      <p className="mb-2 text-xs font-bold uppercase tracking-[0.22em] text-[#c28d27]">Rental requests</p>
      <h2 className="text-3xl font-semibold tracking-[-0.05em] text-[#123b35]">Booking requests</h2>
      {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      {loading ? (
        <p role="status" className="mt-5 rounded-2xl bg-[#fffdf9] p-6 text-sm text-[#68756f]">Loading booking requests…</p>
      ) : bookings.length === 0 ? (
        <p className="mt-5 rounded-2xl bg-[#fffdf9] p-6 text-sm text-[#68756f]">No rental requests yet.</p>
      ) : (
        <div className="mt-5 grid gap-4">
          {bookings.map((booking) => (
            <article key={booking.id} className="rounded-2xl border border-[#e2ded5] bg-[#fffdf9] p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-[#123b35]">
                    {booking.year} {booking.make} {booking.model}
                  </h3>
                  <p className="mt-1 text-sm text-[#68756f]">
                    {booking.startDate} – {booking.endDate} · {booking.totalDays} {booking.totalDays === 1 ? "day" : "days"}
                  </p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${booking.status === "pending" ? "bg-[#fff3d6] text-[#76571b]" : booking.status === "confirmed" ? "bg-[#e6f2e8] text-[#245c4c]" : "bg-[#f9e5df] text-[#943d22]"}`}>
                  {booking.status}
                </span>
              </div>
              <div className="mt-4 grid gap-2 text-sm text-[#68756f] sm:grid-cols-2">
                <p><span className="font-semibold text-[#123b35]">Customer:</span> {booking.customerName}</p>
                <p><span className="font-semibold text-[#123b35]">Phone:</span> <a className="underline" href={`tel:${booking.customerPhone}`}>{booking.customerPhone}</a></p>
                <p><span className="font-semibold text-[#123b35]">Email:</span> <a className="underline" href={`mailto:${booking.customerEmail}`}>{booking.customerEmail}</a></p>
                <p><span className="font-semibold text-[#123b35]">Estimated total:</span> {booking.estimatedTotal.toLocaleString()} FCFA</p>
              </div>
              {booking.message && <p className="mt-4 rounded-xl bg-[#f4f1eb] p-3 text-sm leading-6 text-[#68756f]">{booking.message}</p>}
              {booking.conversationId && (
                <Link
                  href={`/dashboard/bookings/${booking.id}/chat`}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#123b35] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#245c4c]"
                >
                  {booking.status === "cancelled" ? "View chat history" : "Message customer"}
                  <span className="text-white/70" aria-hidden="true">→</span>
                </Link>
              )}
              {(booking.status === "pending" || booking.status === "confirmed") && (
                <div className="mt-5 flex flex-wrap gap-3">
                  {booking.status === "pending" && (
                    <>
                  <button type="button" disabled={updatingId === booking.id} onClick={() => void updateStatus(booking.id, "confirmed")} className="rounded-xl bg-[#123b35] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#245c4c] disabled:opacity-60">
                    {updatingId === booking.id ? "Updating…" : "Confirm request"}
                  </button>
                  <button type="button" disabled={updatingId === booking.id} onClick={() => void updateStatus(booking.id, "declined")} className="rounded-xl border border-[#d6dcd5] px-4 py-2.5 text-sm font-semibold text-[#68756f] transition hover:bg-[#f4f1eb] disabled:opacity-60">
                    Decline
                  </button>
                    </>
                  )}
                  <button
                    type="button"
                    disabled={cancellingId === booking.id || updatingId === booking.id}
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
