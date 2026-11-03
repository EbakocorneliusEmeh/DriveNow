"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import SettingsLink from "@/components/SettingsLink";
import { useAuth } from "@/hooks/useAuth";
import CustomerBookings from "../CustomerBookings";

export default function CustomerBookingsPage() {
  const router = useRouter();
  const { user, role, isLoading, error } = useAuth();

  useEffect(() => {
    if (!isLoading && role !== "customer") {
      router.replace(role ? "/dashboard" : "/login");
    }
  }, [isLoading, role, router]);

  function handleLogout() {
    sessionStorage.removeItem("drivenow_access_token");
    sessionStorage.removeItem("drivenow_refresh_token");
    router.replace("/login");
  }

  if (isLoading || role !== "customer" || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f4f1eb] px-5 text-center text-sm text-[#68756f]">
        <p role={error ? "alert" : "status"}>
          {error ?? (isLoading ? "Loading your customer workspace…" : "Taking you to the right page…")}
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f4f1eb] text-[#18211f]">
      <aside className="fixed inset-y-0 left-0 z-10 hidden w-64 flex-col border-r border-[#e2ded5] bg-[#fffdf9] px-6 py-8 lg:flex">
        <Link href="/" className="text-xl font-bold tracking-[-0.06em] text-[#123b35]">
          Drive<span className="text-[#d9a441]">Now</span>
        </Link>
        <p className="mt-12 px-3 text-xs font-bold uppercase tracking-[0.18em] text-[#87928c]">Customer workspace</p>
        <nav className="mt-4 space-y-2 text-sm font-semibold" aria-label="Customer navigation">
          <Link href="/dashboard" className="flex items-center gap-3 rounded-xl px-4 py-3 text-[#68756f] transition hover:bg-[#f4f1eb] hover:text-[#123b35]">
            <span aria-hidden="true">⌂</span> Browse cars
          </Link>
          <Link href="/dashboard/bookings" aria-current="page" className="flex items-center gap-3 rounded-xl bg-[#123b35] px-4 py-3 text-white">
            <span aria-hidden="true">◷</span> My bookings
          </Link>
          <Link href="/dashboard/messages" className="flex items-center gap-3 rounded-xl px-4 py-3 text-[#68756f] transition hover:bg-[#f4f1eb] hover:text-[#123b35]">
            <span aria-hidden="true">□</span> Messages
          </Link>
          <SettingsLink />
          <button type="button" onClick={handleLogout} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-[#68756f] transition hover:bg-[#f4f1eb] hover:text-[#123b35]">
            <span aria-hidden="true">↩</span> Log out
          </button>
        </nav>
        <div className="mt-auto rounded-2xl bg-[#e9eee7] p-4">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#c28d27]">Need another car?</p>
          <p className="mt-3 text-sm font-semibold leading-5 text-[#123b35]">Browse local vehicles and send a new rental request.</p>
          <Link href="/dashboard#vehicles" className="mt-4 inline-block text-xs font-bold text-[#245c4c]">
            Browse vehicles ↗
          </Link>
        </div>
      </aside>

      <section className="lg:ml-64">
        <header className="flex items-center justify-between border-b border-[#e2ded5] bg-[#f4f1eb]/90 px-5 py-4 backdrop-blur sm:px-10">
          <Link href="/dashboard" className="text-lg font-bold tracking-[-0.06em] text-[#123b35] lg:hidden">
            Drive<span className="text-[#d9a441]">Now</span>
          </Link>
          <p className="hidden text-sm font-medium text-[#68756f] sm:block">Customer workspace</p>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-[#68756f] sm:inline">{user.fullName}</span>
            <Link href="/dashboard" className="rounded-xl border border-[#d6dcd5] bg-[#fffdf9] px-4 py-2.5 text-sm font-semibold text-[#245c4c] transition hover:bg-[#e9eee7]">
              Browse cars
            </Link>
          </div>
        </header>

        <div className="mx-auto max-w-5xl px-5 py-8 sm:px-10 sm:py-12">
          <div className="mb-8 rounded-3xl bg-[#123b35] px-6 py-7 text-[#f4f1eb] sm:px-9 sm:py-9">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#d9a441]">Customer workspace</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em] sm:text-4xl">Your rental activity</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#b8ccc5]">
              Review every request, see which dealers have responded, and keep your trip details in one place.
            </p>
          </div>
          <CustomerBookings />
        </div>
      </section>
    </main>
  );
}
