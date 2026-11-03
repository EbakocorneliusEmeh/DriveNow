"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import VehicleList from "./VehicleList";
import BookingRequests from "./BookingRequests";

const API_URL = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api"}/dealers`;

type DealerProfile = {
  businessName: string;
  businessEmail: string;
  businessPhone: string;
  businessAddress: string;
  description: string;
  logoUrl: string | null;
  profilePictureUrl: string | null;
  approvalStatus: "pending" | "approved" | "rejected";
};

type ProfileResponse = {
  success: boolean;
  message?: string;
  data?: { profile: DealerProfile | null };
};

export default function DealerDashboardPage() {
  const { role, isLoading } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<DealerProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isLoading && role !== "dealer") {
      router.replace(role ? "/dashboard" : "/login");
    }
  }, [isLoading, role, router]);

  useEffect(() => {
    if (isLoading || role !== "dealer") return;

    async function loadProfile() {
      const token = sessionStorage.getItem("drivenow_access_token");
      if (!token) {
        router.replace("/login");
        return;
      }

      try {
        const response = await fetch(`${API_URL}/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const result = (await response.json()) as ProfileResponse;
        if (!response.ok || !result.success) {
          throw new Error(result.message ?? "Unable to load your business profile.");
        }
        setProfile(result.data?.profile ?? null);
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "Unable to load your business profile.");
      } finally {
        setLoadingProfile(false);
      }
    }

    void loadProfile();
  }, [isLoading, role, router]);

  if (isLoading || role !== "dealer" || loadingProfile) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f4f1eb] px-5 text-center text-sm text-[#68756f]">
        <p role="status">
          {isLoading || loadingProfile ? "Loading your dealer workspace…" : "Taking you to the right page…"}
        </p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f4f1eb] px-5">
        <p role="alert" className="rounded-2xl bg-[#fffdf9] p-6 text-sm text-red-800 shadow-sm">{error}</p>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="min-h-screen bg-[#f4f1eb] px-5 py-12 text-[#18211f]">
        <section className="mx-auto max-w-xl rounded-3xl bg-[#fffdf9] p-8 text-center shadow-sm sm:p-12">
          <h1 className="text-2xl font-semibold text-[#123b35]">Set up your business profile</h1>
          <p className="mt-3 text-sm leading-6 text-[#68756f]">
            Add your business details and picture to get your dealer workspace ready.
          </p>
          <Link href="/become-a-dealer" className="mt-6 inline-flex rounded-xl bg-[#d9a441] px-5 py-3 text-sm font-bold text-[#18211f]">
            Create business profile
          </Link>
        </section>
      </main>
    );
  }

  const statusStyles = {
    approved: "bg-[#e6f2e8] text-[#245c4c]",
    pending: "bg-[#fff3d6] text-[#76571b]",
    rejected: "bg-[#f9e5df] text-[#943d22]",
  }[profile.approvalStatus];

  return (
    <main className="min-h-screen bg-[#f4f1eb] px-5 py-8 text-[#18211f] sm:px-10 sm:py-12">
      <div className="mx-auto max-w-6xl">
        <nav className="flex items-center justify-between">
          <Link href="/" className="text-xl font-bold tracking-[-0.06em] text-[#123b35]">
            Drive<span className="text-[#d9a441]">Now</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/messages"
              className="rounded-full border border-[#d6dcd5] bg-[#fffdf9] px-4 py-2 text-sm font-semibold text-[#245c4c] transition hover:bg-[#e9eee7]"
            >
              Messages
            </Link>
            <Link
              href="/dashboard"
              className="rounded-full border border-[#d6dcd5] bg-[#fffdf9] px-4 py-2 text-sm font-semibold text-[#245c4c] transition hover:bg-[#e9eee7]"
            >
              Main dashboard
            </Link>
          </div>
        </nav>

        <section className="mt-8 overflow-hidden rounded-3xl border border-[#e2ded5] bg-[#fffdf9] shadow-sm">
          <div className="relative z-0 flex h-80 items-center justify-center overflow-hidden bg-gradient-to-br from-[#123b35] via-[#245c4c] to-[#527866] sm:h-[30rem]">
            <div className="absolute -right-10 -top-32 h-80 w-80 rounded-full border-[3rem] border-white/10" />
            <div className="absolute -bottom-36 left-1/3 h-72 w-72 rounded-full border-[3rem] border-[#d9a441]/20" />
            {profile.logoUrl ? (
              <Image
                src={profile.logoUrl}
                alt={`${profile.businessName} business logo`}
                fill
                unoptimized
                className="z-10 object-cover"
              />
            ) : (
              <div className="z-10 px-6 text-center text-4xl font-bold tracking-tight text-white/90 sm:text-5xl">
                {profile.businessName}
              </div>
            )}
            <div className="absolute left-6 top-6 z-10 rounded-full bg-black/15 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-white/90 sm:left-8 sm:top-8">
              Dealer workspace
            </div>
            <Link
              href="/dashboard/dealer/profile#business-logo"
              className="absolute right-6 top-6 z-20 inline-flex items-center gap-2 rounded-full border border-white/30 bg-[#123b35]/85 px-4 py-2 text-xs font-semibold text-white shadow-sm backdrop-blur transition hover:bg-[#123b35] sm:right-8 sm:top-8"
            >
              <span aria-hidden="true">✎</span>
              Change logo
            </Link>
          </div>

          <div className="px-6 pb-7 sm:px-10 sm:pb-9">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div className="relative z-20 -mt-16 flex min-w-0 flex-col gap-4 sm:-mt-[4.5rem] sm:flex-row sm:items-end sm:gap-5">
                <div className="flex h-32 w-32 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-[#fffdf9] bg-[#d9a441] text-4xl font-bold text-[#123b35] shadow-lg sm:h-36 sm:w-36">
                  {profile.profilePictureUrl ? (
                    <Image
                      src={profile.profilePictureUrl}
                      alt={`${profile.businessName} profile picture`}
                      width={144}
                      height={144}
                      unoptimized
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    profile.businessName.slice(0, 1).toUpperCase()
                  )}
                </div>
                <div className="pb-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <h1 className="text-2xl font-bold tracking-tight text-[#123b35] sm:text-3xl">
                      {profile.businessName}
                    </h1>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusStyles}`}>
                      {profile.approvalStatus}
                    </span>
                  </div>
                </div>
              </div>

              <Link
                href="/dashboard/dealer/profile"
                className="inline-flex shrink-0 translate-y-2 items-center justify-center gap-2 rounded-xl bg-[#123b35] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#245c4c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#123b35]"
              >
                <span aria-hidden="true">✎</span>
                Edit profile
              </Link>
            </div>

            <div className="mt-7 grid gap-3 border-t border-[#e9e5dc] pt-6 sm:grid-cols-3">
              <div className="rounded-2xl bg-[#f4f1eb] p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#87928c]">Business phone</p>
                <p className="mt-2 break-words text-sm font-semibold text-[#123b35]">{profile.businessPhone}</p>
              </div>
              <div className="rounded-2xl bg-[#f4f1eb] p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#87928c]">Business email</p>
                <p className="mt-2 break-words text-sm font-semibold text-[#123b35]">{profile.businessEmail}</p>
              </div>
              <div className="rounded-2xl bg-[#f4f1eb] p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#87928c]">Business address</p>
                <p className="mt-2 break-words text-sm font-semibold text-[#123b35]">{profile.businessAddress}</p>
              </div>
            </div>
          </div>
        </section>

        <BookingRequests />
        <VehicleList />
      </div>
    </main>
  );
}
