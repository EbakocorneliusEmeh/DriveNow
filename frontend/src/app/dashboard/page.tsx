"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const API_URL = "http://localhost:4000/api/auth";
const API_ORIGIN = "http://localhost:4000";

type CurrentUser = {
  fullName: string;
  avatarUrl: string | null;
  role: "customer" | "dealer" | "admin";
};

type CurrentUserResponse = {
  success: boolean;
  data?: { user: CurrentUser };
};

function getInitials(fullName: string) {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((name) => name[0]?.toUpperCase())
    .join("");
}

function getAvatarSource(avatarUrl: string) {
  return avatarUrl.startsWith("/") ? `${API_ORIGIN}${avatarUrl}` : avatarUrl;
}

function formatRole(role: CurrentUser["role"]) {
  return `${role.charAt(0).toUpperCase()}${role.slice(1)} account`;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  const [isPictureOpen, setIsPictureOpen] = useState(false);

  useEffect(() => {
    const token = sessionStorage.getItem("drivenow_access_token");
    if (!token) {
      router.replace("/login");
      return;
    }

    async function loadCurrentUser() {
      try {
        const response = await fetch(`${API_URL}/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) {
          sessionStorage.removeItem("drivenow_access_token");
          router.replace("/login");
          return;
        }

        const result = (await response.json()) as CurrentUserResponse;
        if (!result.success || !result.data?.user) {
          throw new Error("Unable to load the signed-in user");
        }
        setUser(result.data.user);
      } catch {
        sessionStorage.removeItem("drivenow_access_token");
        router.replace("/login");
      }
    }

    void loadCurrentUser();
  }, [router]);

  useEffect(() => {
    const updateClock = () => setNow(new Date());
    updateClock();
    const interval = window.setInterval(updateClock, 1_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!isPictureOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsPictureOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isPictureOpen]);

  const displayName = user?.fullName ?? "Loading…";
  const firstName = user?.fullName.split(/\s+/)[0] ?? "there";
  const currentDateTime = now?.toLocaleString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }) ?? "Loading current time…";

  return (
    <main className="min-h-screen bg-[#f4f1eb] text-[#18211f]">
      <aside className="fixed inset-y-0 left-0 z-10 hidden w-64 flex-col border-r border-[#e2ded5] bg-[#fffdf9] px-6 py-8 lg:flex">
        <Link href="/" className="text-xl font-bold tracking-[-0.06em] text-[#123b35]">Drive<span className="text-[#d9a441]">Now</span></Link>
        <div className="mt-16 space-y-2 text-sm font-semibold">
          <Link href="/dashboard" className="flex items-center gap-3 rounded-xl bg-[#123b35] px-4 py-3 text-white"><span>⌂</span> Overview</Link>
          <a href="#vehicles" className="flex items-center gap-3 rounded-xl px-4 py-3 text-[#68756f] transition hover:bg-[#f4f1eb] hover:text-[#123b35]"><span>▦</span> Browse vehicles</a>
          <a href="#bookings" className="flex items-center gap-3 rounded-xl px-4 py-3 text-[#68756f] transition hover:bg-[#f4f1eb] hover:text-[#123b35]"><span>◷</span> My bookings</a>
          <a href="#messages" className="flex items-center gap-3 rounded-xl px-4 py-3 text-[#68756f] transition hover:bg-[#f4f1eb] hover:text-[#123b35]"><span>□</span> Messages</a>
        </div>
        <div className="mt-auto rounded-2xl bg-[#e9eee7] p-4"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#c28d27]">For businesses</p><p className="mt-3 text-sm font-semibold leading-5 text-[#123b35]">Create your business profile before listing your vehicles.</p><Link href="/become-a-dealer" className="mt-4 inline-block text-xs font-bold text-[#245c4c]">Become a dealer ↗</Link></div>
      </aside>

      <section className="lg:ml-64">
        <header className="flex items-center justify-between border-b border-[#e2ded5] bg-[#f4f1eb]/90 px-6 py-5 backdrop-blur sm:px-10"><div className="lg:hidden"><Link href="/" className="text-lg font-bold tracking-[-0.06em] text-[#123b35]">Drive<span className="text-[#d9a441]">Now</span></Link></div><p className="hidden text-sm font-medium text-[#68756f] sm:block" aria-live="polite">{currentDateTime}</p><div className="flex items-center gap-3 sm:gap-4"><Link href="/profile" className="rounded-xl border border-[#d6dcd5] bg-[#fffdf9] px-3 py-2 text-xs font-bold text-[#245c4c] transition hover:bg-[#e9eee7] sm:px-4 sm:py-3 sm:text-sm">Edit profile</Link><button type="button" className="relative rounded-full border border-[#d6dcd5] bg-[#fffdf9] p-3 text-sm">♧<span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[#d9a441]" /></button><div className="flex items-center gap-3">{user?.avatarUrl ? <button type="button" onClick={() => setIsPictureOpen(true)} aria-label={`View ${user.fullName}'s profile picture`} className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-[#d9a441] ring-offset-2 transition hover:ring-2 hover:ring-[#d9a441] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#123b35]"><Image src={getAvatarSource(user.avatarUrl)} alt="" width={36} height={36} unoptimized className="h-full w-full object-cover" /></button> : <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-[#d9a441] text-xs font-bold text-[#123b35]">{user ? getInitials(user.fullName) : "…"}</div>}<div className="hidden text-left sm:block"><p className="text-xs font-bold text-[#123b35]">{displayName}</p><p className="text-[11px] text-[#87928c]">{user ? formatRole(user.role) : "Loading account…"}</p></div></div></div></header>

        <div className="mx-auto max-w-7xl px-6 py-8 sm:px-10 lg:px-12 lg:py-12">
          <section className="relative overflow-hidden rounded-[1.75rem] bg-[#123b35] px-7 py-9 text-[#f4f1eb] sm:px-10 sm:py-12"><div className="absolute -right-20 -top-32 h-80 w-80 rounded-full border-[4rem] border-[#d9a441]/20" /><div className="relative"><p className="mb-4 text-xs font-bold uppercase tracking-[0.25em] text-[#d9a441]">Good morning, {firstName}</p><h1 className="max-w-xl text-4xl font-semibold leading-tight tracking-[-0.06em] sm:text-6xl">Find a car that<br /><span className="text-[#d9a441]">fits your plans.</span></h1><p className="mt-5 max-w-md text-sm leading-6 text-[#b8ccc5]">Vehicle listings from trusted local dealers will appear here when they are published.</p>{user?.role === "admin" && <Link href="/admin" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#d9a441] px-5 py-3 text-sm font-bold text-[#123b35] transition hover:bg-[#e7b955] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f4f1eb]">Go to Admin Dashboard <span aria-hidden="true">→</span></Link>}</div></section>

          <section className="grid gap-4 py-8 sm:grid-cols-3"><div className="rounded-2xl bg-[#fffdf9] p-5"><p className="text-xs text-[#87928c]">Available today</p><p className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-[#123b35]">0</p><p className="mt-1 text-xs text-[#245c4c]">Vehicles ready to move</p></div><div className="rounded-2xl bg-[#d9a441] p-5"><p className="text-xs text-[#76571b]">Your bookings</p><p className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-[#123b35]">0</p><p className="mt-1 text-xs text-[#76571b]">Start your first trip</p></div><div className="rounded-2xl bg-[#e4ded2] p-5"><p className="text-xs text-[#7c6949]">Saved vehicles</p><p className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-[#123b35]">0</p><p className="mt-1 text-xs text-[#7c6949]">Keep favourites close</p></div></section>

          <section id="vehicles"><p className="mb-2 text-xs font-bold uppercase tracking-[0.22em] text-[#c28d27]">The marketplace</p><h2 className="text-3xl font-semibold tracking-[-0.05em] text-[#123b35]">Vehicles for you</h2><div className="mt-6 rounded-2xl bg-[#fffdf9] p-8 text-center text-sm text-[#68756f]">No vehicle listings have been published yet.</div></section>
        </div>
      </section>
      {isPictureOpen && user?.avatarUrl && <div role="dialog" aria-modal="true" aria-label={`${user.fullName}'s profile picture`} onClick={() => setIsPictureOpen(false)} className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm"><button type="button" autoFocus onClick={() => setIsPictureOpen(false)} aria-label="Close full-size profile picture" className="absolute right-5 top-5 rounded-full bg-white/15 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/25">Close ✕</button><div onClick={(event) => event.stopPropagation()} className="flex max-h-[90vh] max-w-[90vw] flex-col items-center gap-4"><Image src={getAvatarSource(user.avatarUrl)} alt={`${user.fullName}'s profile picture`} width={1200} height={1200} unoptimized className="max-h-[82vh] max-w-[88vw] rounded-2xl object-contain shadow-2xl" /><p className="text-sm font-medium text-white">{user.fullName}</p></div></div>}
    </main>
  );
}
