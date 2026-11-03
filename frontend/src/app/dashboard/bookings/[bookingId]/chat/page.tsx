"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import BookingChat from "@/components/BookingChat";
import { useAuth } from "@/hooks/useAuth";

export default function BookingChatPage() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const router = useRouter();
  const { user, role, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && role !== "customer" && role !== "dealer") {
      router.replace(role ? "/dashboard" : "/login");
    }
  }, [isLoading, role, router]);

  if (isLoading || (role !== "customer" && role !== "dealer")) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f4f1eb] px-5 text-center text-sm text-[#68756f]">
        <p role="status">Opening your booking chat…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f4f1eb] px-4 py-6 text-[#18211f] sm:px-8 sm:py-10">
      <div className="mx-auto max-w-4xl">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <Link href={role === "dealer" ? "/dashboard/dealer" : "/dashboard/bookings"} className="text-sm font-semibold text-[#245c4c] hover:underline">
              ← Back to {role === "dealer" ? "dealer dashboard" : "my bookings"}
            </Link>
            <p className="mt-2 text-xs text-[#87928c]">Signed in as {user?.fullName}</p>
          </div>
          <Link href="/dashboard" className="text-sm font-semibold text-[#245c4c] hover:underline">
            Browse cars
          </Link>
        </div>
        <BookingChat bookingId={bookingId} />
      </div>
    </main>
  );
}
