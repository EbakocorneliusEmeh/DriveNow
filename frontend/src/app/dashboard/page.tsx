"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { registerForPushNotifications } from "@/lib/firebase-messaging";
import SettingsLink from "@/components/SettingsLink";
import { useAuth } from "@/hooks/useAuth";
import Search, { type VehicleSearchCriteria } from "./Search";

const API_ORIGIN = "http://localhost:4000";

type CurrentUser = {
  fullName: string;
  avatarUrl: string | null;
  role: "customer" | "dealer" | "admin";
};

type UserNotification = {
  id: string;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

type MarketplaceVehicle = {
  id: string;
  make: string;
  model: string;
  year: number;
  dailyRate: number;
  location: string;
  description: string;
  imageUrls: string[];
  businessName: string;
  businessPhone: string;
};

function getInitials(fullName: string) {
  if (!fullName) {
    return "";
  }
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((name) => name[0]?.toUpperCase())
    .join("");
}

function getAvatarSource(avatarUrl: string) {
  if (avatarUrl.startsWith("http")) {
    return avatarUrl;
  }
  return avatarUrl.startsWith("/") ? `${API_ORIGIN}${avatarUrl}` : avatarUrl;
}

function formatRole(role: CurrentUser["role"]) {
  return `${role.charAt(0).toUpperCase()}${role.slice(1)} account`;
}

function getVehicleHref(vehicleId: string, rent = false) {
  return `/vehicles/${vehicleId}${rent ? "#rent" : ""}`;
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading, error: authError } = useAuth();
  const [now, setNow] = useState<Date | null>(null);
  const [isPictureOpen, setIsPictureOpen] = useState(false);
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [pushMessage, setPushMessage] = useState("");
  const [isRegisteringPush, setIsRegisteringPush] = useState(false);
  const [vehicles, setVehicles] = useState<MarketplaceVehicle[]>([]);
  const searchRequestId = useRef(0);
  const [searchResults, setSearchResults] = useState<MarketplaceVehicle[] | null>(null);
  const [searchCriteria, setSearchCriteria] = useState<VehicleSearchCriteria | null>(null);
  const [searchError, setSearchError] = useState("");
  const [isSearchingVehicles, setIsSearchingVehicles] = useState(false);
  const [vehicleError, setVehicleError] = useState("");
  const [isLoadingVehicles, setIsLoadingVehicles] = useState(true);

  useEffect(() => {
    async function loadVehicles() {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";
        const response = await fetch(`${apiUrl}/vehicles`);
        const result = await response.json() as {
          success: boolean;
          message?: string;
          data?: { vehicles: MarketplaceVehicle[] };
        };
        if (!response.ok || !result.success || !result.data) {
          throw new Error(result.message ?? "Unable to load vehicle listings.");
        }
        setVehicles(result.data.vehicles);
      } catch (error) {
        setVehicleError(error instanceof Error ? error.message : "Unable to load vehicle listings.");
      } finally {
        setIsLoadingVehicles(false);
      }
    }

    void Promise.resolve().then(loadVehicles);
  }, []);

  async function searchVehicles(criteria: VehicleSearchCriteria) {
    const requestId = ++searchRequestId.current;
    setIsSearchingVehicles(true);
    setSearchError("");
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";
      const response = await fetch(`${apiUrl}/vehicles/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(criteria),
      });
      const result = await response.json() as {
        success: boolean;
        message?: string;
        data?: { vehicles: MarketplaceVehicle[] };
      };
      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.message ?? "Unable to search available vehicles.");
      }
      if (requestId !== searchRequestId.current) return;
      setSearchResults(result.data.vehicles);
      setSearchCriteria(criteria);
    } catch (error) {
      if (requestId !== searchRequestId.current) return;
      setSearchResults(null);
      setSearchCriteria(criteria);
      setSearchError(error instanceof Error ? error.message : "Unable to search available vehicles.");
    } finally {
      if (requestId === searchRequestId.current) setIsSearchingVehicles(false);
    }
  }

  async function loadNotifications() {
    const token = sessionStorage.getItem("drivenow_access_token");
    if (!token) return;
    const response = await fetch("http://localhost:4000/api/notifications", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error("Could not load notifications.");
    const result = await response.json() as { success: boolean; data?: { notifications: UserNotification[] } };
    if (result.success) setNotifications(result.data?.notifications ?? []);
  }

  async function enableNotifications() {
    const token = sessionStorage.getItem("drivenow_access_token");
    if (!token) return;
    setIsRegisteringPush(true);
    setPushMessage("");
    try {
      const installationId = await registerForPushNotifications();
      const response = await fetch("http://localhost:4000/api/notifications/installation", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ installationId }),
      });
      if (!response.ok) throw new Error("Could not save this browser for push notifications.");
      setPushMessage("Notifications are enabled for this browser.");
    } catch (error) {
      setPushMessage(error instanceof Error ? error.message : "Could not enable notifications.");
    } finally {
      setIsRegisteringPush(false);
    }
  }

  async function openNotification(item: UserNotification) {
    const token = sessionStorage.getItem("drivenow_access_token");
    if (token && !item.readAt) {
      await fetch(`http://localhost:4000/api/notifications/${item.id}/read`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications((current) => current.map((notification) => notification.id === item.id
        ? { ...notification, readAt: new Date().toISOString() }
        : notification));
    }
    setIsNotificationsOpen(false);
    if (item.link) router.push(item.link);
  }



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

  const displayName = user?.fullName ?? (isAuthLoading ? "Loading…" : "Account unavailable");
  const firstName = user?.fullName?.split(/\s+/)[0] ?? "there";
  const unreadNotificationCount = notifications.filter((item) => !item.readAt).length;
  const matchingVehicles = searchCriteria ? searchResults ?? [] : vehicles;
  const currentDateTime = now?.toLocaleString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }) ?? "Loading current time…";

  function handleLogout() {
    sessionStorage.removeItem("drivenow_access_token");
    sessionStorage.removeItem("drivenow_refresh_token");
    router.replace("/login");
  }

  return (
    <main className="min-h-screen bg-[#f4f1eb] text-[#18211f]">
      {authError && <p role="alert" className="border-b border-red-200 bg-red-50 px-6 py-3 text-center text-sm text-red-800">{authError}</p>}
      <aside className="fixed inset-y-0 left-0 z-10 hidden w-64 flex-col border-r border-[#e2ded5] bg-[#fffdf9] px-6 py-8 lg:flex">
        <Link href="/" className="text-xl font-bold tracking-[-0.06em] text-[#123b35]">Drive<span className="text-[#d9a441]">Now</span></Link>
        <div className="mt-16 space-y-2 text-sm font-semibold">
          <Link href="/dashboard" className="flex items-center gap-3 rounded-xl bg-[#123b35] px-4 py-3 text-white"><span>⌂</span> Overview</Link>
          <SettingsLink />
          <button onClick={handleLogout} className="flex items-center gap-3 rounded-xl px-4 py-3 text-[#68756f] transition hover:bg-[#f4f1eb] hover:text-[#123b35]"><span>↩️</span> Logout</button>
          <a href="#vehicles" className="flex items-center gap-3 rounded-xl px-4 py-3 text-[#68756f] transition hover:bg-[#f4f1eb] hover:text-[#123b35]"><span>▦</span> Browse vehicles</a>
          <Link href="/dashboard/bookings" className="flex items-center gap-3 rounded-xl px-4 py-3 text-[#68756f] transition hover:bg-[#f4f1eb] hover:text-[#123b35]"><span>◷</span> My bookings</Link>
          <Link href="/dashboard/messages" className="flex items-center gap-3 rounded-xl px-4 py-3 text-[#68756f] transition hover:bg-[#f4f1eb] hover:text-[#123b35]"><span>□</span> Messages</Link>
        </div>
        <div className="mt-auto rounded-2xl bg-[#e9eee7] p-4"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#c28d27]">For businesses</p><p className="mt-3 text-sm font-semibold leading-5 text-[#123b35]">Create your business profile before listing your vehicles.</p><Link href="/become-a-dealer" className="mt-4 inline-block text-xs font-bold text-[#245c4c]">Become a dealer ↗</Link></div>
      </aside>

      <section className="lg:ml-64">
        <header className="flex items-center justify-between border-b border-[#e2ded5] bg-[#f4f1eb]/90 px-6 py-5 backdrop-blur sm:px-10"><div className="lg:hidden"><Link href="/" className="text-lg font-bold tracking-[-0.06em] text-[#123b35]">Drive<span className="text-[#d9a441]">Now</span></Link></div><p className="hidden text-sm font-medium text-[#68756f] sm:block" aria-live="polite">{currentDateTime}</p><div className="flex items-center gap-3 sm:gap-4"><div className="relative"><button type="button" aria-label={unreadNotificationCount > 0 ? `Open notifications (${unreadNotificationCount} unread)` : "Open notifications"} aria-expanded={isNotificationsOpen} onClick={() => { const opening = !isNotificationsOpen; setIsNotificationsOpen(opening); if (opening) void loadNotifications().catch(() => setPushMessage("Could not load notifications.")); }} className="relative rounded-full border border-[#d6dcd5] bg-[#fffdf9] p-3 text-sm">♧{unreadNotificationCount > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#d9a441] px-1 text-[10px] font-bold text-[#123b35] shadow-sm">{unreadNotificationCount > 9 ? "9+" : unreadNotificationCount}</span>}</button>{isNotificationsOpen && <div className="absolute right-0 top-14 z-30 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-[#e2ded5] bg-[#fffdf9] p-4 shadow-xl"><div className="flex items-center justify-between"><h2 className="font-semibold text-[#123b35]">Notifications</h2><button type="button" onClick={() => void enableNotifications()} disabled={isRegisteringPush} className="text-xs font-bold text-[#245c4c] disabled:opacity-60">{isRegisteringPush ? "Enabling…" : "Enable push"}</button></div>{pushMessage && <p role="status" className="mt-3 text-xs text-[#68756f]">{pushMessage}</p>}<div className="mt-3 max-h-80 divide-y divide-[#e9e5dc] overflow-y-auto">{notifications.length ? notifications.map((item) => <button type="button" key={item.id} onClick={() => void openNotification(item)} className={`block w-full py-3 text-left ${item.readAt ? "opacity-70" : ""}`}><span className="block text-sm font-semibold text-[#123b35]">{item.title}</span><span className="mt-1 block text-xs leading-5 text-[#68756f]">{item.body}</span></button>) : <p className="py-5 text-center text-sm text-[#68756f]">You’re all caught up.</p>}</div></div>}</div><div className="flex items-center gap-3">{user?.avatarUrl ? <button type="button" onClick={() => setIsPictureOpen(true)} aria-label={`View ${user.fullName}'s profile picture`} className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-[#d9a441] ring-offset-2 transition hover:ring-2 hover:ring-[#d9a441] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#123b35]"><Image src={getAvatarSource(user.avatarUrl)} alt="" width={36} height={36} unoptimized className="h-full w-full object-cover" /></button> : <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-[#d9a441] text-xs font-bold text-[#123b35]">{user ? getInitials(user.fullName) : "…"}</div>}<div className="hidden text-left sm:block"><p className="text-xs font-bold text-[#123b35]">{displayName}</p><p className="text-[11px] text-[#87928c]">{isAuthLoading ? "Loading account…" : user ? formatRole(user.role) : ""}</p></div></div></div></header>

        <div className="mx-auto max-w-7xl px-6 py-8 sm:px-10 lg:px-12 lg:py-12">
          <div className="mb-8 flex items-center justify-between">
            <h1 className="text-4xl font-bold">Dashboard</h1>
            <div className="flex space-x-4">
              {!isAuthLoading && user?.role === "admin" && (
                <Link
                  href="/admin"
                  className="rounded-xl bg-[#123b35] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#245c4c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d9a441]"
                >
                  Admin Page
                </Link>
              )}
              {!isAuthLoading && user?.role === "dealer" && (
                <Link
                  href="/dashboard/dealer"
                  className="rounded-xl bg-[#d9a441] px-5 py-3 text-sm font-bold text-[#18211f] transition hover:bg-[#e7b95b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#123b35]"
                >
                  Dealer Dashboard
                </Link>
              )}
              {!isAuthLoading && user?.role === "customer" && (
                <Link
                  href="/dashboard/bookings"
                  className="rounded-xl bg-[#123b35] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#245c4c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d9a441]"
                >
                  My bookings
                </Link>
              )}
            </div>
          </div>

          <section className="relative overflow-hidden rounded-[1.75rem] bg-[#123b35] px-7 py-9 text-[#f4f1eb] sm:px-10 sm:py-12"><div className="absolute -right-20 -top-32 h-80 w-80 rounded-full border-[4rem] border-[#d9a441]/20" /><div className="relative"><p className="mb-4 text-xs font-bold uppercase tracking-[0.25em] text-[#d9a441]">Good morning, {firstName}</p><h1 className="max-w-xl text-4xl font-semibold leading-tight tracking-[-0.06em] sm:text-6xl">Find a car that<br /><span className="text-[#d9a441]">fits your plans.</span></h1><p className="mt-5 max-w-md text-sm leading-6 text-[#b8ccc5]">Vehicle listings from trusted local dealers will appear here when they are published.</p></div></section>

          <Search onSearch={searchVehicles} />

          <section className="py-8">
            <div className="max-w-sm rounded-2xl bg-[#fffdf9] p-5">
              <p className="text-xs text-[#87928c]">
                {searchCriteria ? "Matching vehicles" : "Available vehicles"}
              </p>
              <p className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-[#123b35]">
                {searchCriteria ? matchingVehicles.length : vehicles.length}
              </p>
              <p className="mt-1 text-xs text-[#245c4c]">
                {searchCriteria?.query
                  ? `Results for "${searchCriteria.query}"`
                  : "Browse cars from trusted local dealers"}
              </p>
            </div>
          </section>

          <section id="vehicles">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.22em] text-[#c28d27]">The marketplace</p>
            <h2 className="text-3xl font-semibold tracking-[-0.05em] text-[#123b35]">
              {searchCriteria ? "Search results" : "Vehicles for you"}
            </h2>
            {vehicleError ? (
              <p role="alert" className="mt-6 rounded-2xl bg-red-50 p-6 text-sm text-red-800">{vehicleError}</p>
            ) : isLoadingVehicles ? (
              <p role="status" className="mt-6 rounded-2xl bg-[#fffdf9] p-8 text-center text-sm text-[#68756f]">Loading available vehicles…</p>
            ) : isSearchingVehicles ? (
              <p role="status" className="mt-6 rounded-2xl bg-[#fffdf9] p-8 text-center text-sm text-[#68756f]">Checking vehicle availability…</p>
            ) : searchError ? (
              <p role="alert" className="mt-6 rounded-2xl bg-red-50 p-6 text-sm text-red-800">
                {searchError} Vehicle availability could not be confirmed, so listings are hidden until the search succeeds.
              </p>
            ) : matchingVehicles.length === 0 ? (
              <div className="mt-6 rounded-2xl bg-[#fffdf9] p-8 text-center text-sm text-[#68756f]">
                {searchCriteria
                  ? "No vehicles match that location and date range. Try different dates or another location."
                  : "No vehicle listings have been published yet."}
              </div>
            ) : (
              <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {matchingVehicles.map((vehicle) => (
                  <article
                    key={vehicle.id}
                    className="group relative overflow-hidden rounded-2xl border border-[#e2ded5] bg-[#fffdf9] transition hover:shadow-lg"
                  >
                    <Link
                      href={getVehicleHref(vehicle.id)}
                      aria-label={`View details for ${vehicle.year} ${vehicle.make} ${vehicle.model}`}
                      className="absolute inset-0 z-0 rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d9a441]"
                    />
                    <div className="pointer-events-none relative z-10">
                    <div className="relative block h-52 overflow-hidden bg-[#e9eee7]">
                      {vehicle.imageUrls[0] ? (
                        <Image src={vehicle.imageUrls[0]} alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`} fill unoptimized className="object-cover transition duration-300 group-hover:scale-105" />
                      ) : (
                        <span className="flex h-full items-center justify-center text-sm text-[#87928c]">No vehicle photo</span>
                      )}
                      {vehicle.imageUrls.length > 1 && (
                        <span className="absolute bottom-3 right-3 rounded-full bg-black/70 px-2.5 py-1 text-xs font-semibold text-white">
                          +{vehicle.imageUrls.length - 1} photos
                        </span>
                      )}
                    </div>
                    <div className="p-5">
                      <h3 className="text-lg font-semibold text-[#123b35]">{vehicle.year} {vehicle.make} {vehicle.model}</h3>
                      <p className="mt-1 text-sm text-[#68756f]">{vehicle.location} · {vehicle.businessName}</p>
                      <p className="mt-4 border-t border-[#e9e5dc] pt-4 text-base font-bold text-[#123b35]">
                        {vehicle.dailyRate.toLocaleString()} FCFA <span className="text-xs font-normal text-[#68756f]">/ day</span>
                      </p>
                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <span className="inline-flex items-center justify-center rounded-xl border border-[#d6dcd5] px-3 py-3 text-sm font-bold text-[#245c4c]">
                          View details
                        </span>
                        <Link
                          href={getVehicleHref(vehicle.id, true)}
                          className="pointer-events-auto relative z-20 inline-flex items-center justify-center rounded-xl bg-[#123b35] px-3 py-3 text-sm font-bold text-white transition hover:bg-[#245c4c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d9a441]"
                        >
                          Rent now
                        </Link>
                      </div>
                    </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </section>
      {isPictureOpen && user?.avatarUrl && <div role="dialog" aria-modal="true" aria-label={`${user.fullName}'s profile picture`} onClick={() => setIsPictureOpen(false)} className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm"><button type="button" autoFocus onClick={() => setIsPictureOpen(false)} aria-label="Close full-size profile picture" className="absolute right-5 top-5 rounded-full bg-white/15 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/25">Close ✕</button><div onClick={(event) => event.stopPropagation()} className="flex max-h-[90vh] max-w-[90vw] flex-col items-center gap-4"><Image src={getAvatarSource(user.avatarUrl)} alt={`${user.fullName}'s profile picture`} width={1200} height={1200} unoptimized className="max-h-[82vh] max-w-[88vw] rounded-2xl object-contain shadow-2xl" /><p className="text-sm font-medium text-white">{user.fullName}</p></div></div>}
    </main>
  );
}