"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import MessagesInbox from "../MessagesInbox";

export default function MessagesPage() {
  const router = useRouter();
  const { user, role, isLoading, error } = useAuth();

  useEffect(() => {
    if (!isLoading && role !== "customer" && role !== "dealer") {
      router.replace(role ? "/dashboard" : "/login");
    }
  }, [isLoading, role, router]);

  if (isLoading || (role !== "customer" && role !== "dealer") || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f4f1eb] px-5 text-center text-sm text-[#68756f]">
        <p role={error ? "alert" : "status"}>
          {error ?? (isLoading ? "Loading your messages…" : "Taking you to the right page…")}
        </p>
      </main>
    );
  }

  const backHref = role === "dealer" ? "/dashboard/dealer" : "/dashboard/bookings";

  return (
    <main className="min-h-screen bg-[#f4f1eb] px-4 py-6 text-[#18211f] sm:px-8 sm:py-10">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 flex items-center justify-between gap-4">
          <div>
            <Link href={backHref} className="text-sm font-semibold text-[#245c4c] hover:underline">
              ← Back to {role === "dealer" ? "dealer dashboard" : "my bookings"}
            </Link>
            <p className="mt-2 text-xs text-[#87928c]">{user.fullName}</p>
          </div>
          <Link href="/dashboard" className="rounded-xl border border-[#d6dcd5] bg-[#fffdf9] px-4 py-2.5 text-sm font-semibold text-[#245c4c] transition hover:bg-[#e9eee7]">
            Browse cars
          </Link>
        </header>
        <div className="rounded-3xl bg-[#123b35] px-6 py-7 text-[#f4f1eb] sm:px-9 sm:py-9">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#d9a441]">DriveNow messages</p>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#b8ccc5]">
            Chat directly with the customer or dealer about an approved rental. Each conversation stays attached to its booking.
          </p>
        </div>
        <div className="mt-7">
          <MessagesInbox />
        </div>
      </div>
    </main>
  );
}
