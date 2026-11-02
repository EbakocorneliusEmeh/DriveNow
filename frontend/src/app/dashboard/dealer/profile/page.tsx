"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

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

export default function EditDealerProfilePage() {
  const { role, isLoading } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<DealerProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState<"logo" | "profile-picture" | null>(null);
  const [message, setMessage] = useState("");
  const [messageIsError, setMessageIsError] = useState(false);

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
        if (!result.data?.profile) {
          router.replace("/become-a-dealer");
          return;
        }
        setProfile(result.data.profile);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to load your business profile.");
        setMessageIsError(true);
      } finally {
        setLoadingProfile(false);
      }
    }

    void loadProfile();
  }, [isLoading, role, router]);

  function showError(text: string) {
    setMessage(text);
    setMessageIsError(true);
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile) return;

    const token = sessionStorage.getItem("drivenow_access_token");
    if (!token) {
      router.replace("/login");
      return;
    }

    setSaving(true);
    setMessage("");
    setMessageIsError(false);
    try {
      const response = await fetch(`${API_URL}/me`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          businessName: profile.businessName,
          businessEmail: profile.businessEmail,
          businessPhone: profile.businessPhone,
          businessAddress: profile.businessAddress,
          description: profile.description,
          logoUrl: profile.logoUrl ?? "",
        }),
      });
      const result = (await response.json()) as ProfileResponse;
      if (!response.ok || !result.success || !result.data?.profile) {
        throw new Error(result.message ?? "Unable to save your business details.");
      }
      setProfile(result.data.profile);
      setMessage("Your business profile has been saved.");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Unable to save your business details.");
    } finally {
      setSaving(false);
    }
  }

  async function uploadImage(event: ChangeEvent<HTMLInputElement>, imageType: "logo" | "profile-picture") {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      showError("Choose a JPEG, PNG, or WebP image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showError("Choose an image smaller than 5 MB.");
      return;
    }

    const token = sessionStorage.getItem("drivenow_access_token");
    if (!token) {
      router.replace("/login");
      return;
    }

    setUploadingImage(imageType);
    setMessage("");
    setMessageIsError(false);
    try {
      const endpoint = imageType === "logo" ? "logo" : "profile-picture";
      const response = await fetch(`${API_URL}/me/${endpoint}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": file.type,
        },
        body: file,
      });
      const result = (await response.json()) as ProfileResponse;
      if (!response.ok || !result.success || !result.data?.profile) {
        throw new Error(result.message ?? `Unable to upload your ${imageType === "logo" ? "business logo" : "profile picture"}.`);
      }
      setProfile(result.data.profile);
      setMessage(`Your ${imageType === "logo" ? "business logo" : "profile picture"} has been updated.`);
    } catch (error) {
      showError(error instanceof Error ? error.message : `Unable to upload your ${imageType === "logo" ? "business logo" : "profile picture"}.`);
    } finally {
      setUploadingImage(null);
    }
  }

  if (isLoading || role !== "dealer" || loadingProfile) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f4f1eb] px-5 text-center text-sm text-[#68756f]">
        <p role="status">{isLoading || loadingProfile ? "Loading your business profile…" : "Taking you to the right page…"}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f4f1eb] px-5 py-8 text-[#18211f] sm:px-10 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <nav className="flex items-center justify-between">
          <Link href="/" className="text-xl font-bold tracking-[-0.06em] text-[#123b35]">
            Drive<span className="text-[#d9a441]">Now</span>
          </Link>
          <Link
            href="/dashboard/dealer"
            className="rounded-full border border-[#d6dcd5] bg-[#fffdf9] px-4 py-2 text-sm font-semibold text-[#245c4c] transition hover:bg-[#e9eee7]"
          >
            Back to dealer dashboard
          </Link>
        </nav>

        <header className="mt-8 rounded-3xl bg-[#123b35] px-7 py-8 text-[#f4f1eb] sm:px-9 sm:py-10">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#d9a441]">Business settings</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em]">Edit business profile</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-[#b8ccc5]">
            Update how your business appears to customers. Your approval status will not change when you edit these details.
          </p>
        </header>

        {profile ? (
          <form onSubmit={saveProfile} className="mt-7 space-y-6 rounded-3xl border border-[#e2ded5] bg-[#fffdf9] p-6 shadow-sm sm:p-9">
            <section aria-labelledby="images-heading">
              <h2 id="images-heading" className="text-base font-semibold text-[#123b35]">Business images</h2>
              <p className="mt-1 text-sm text-[#68756f]">Your logo is displayed prominently, with your profile picture overlapping it on the dealer dashboard.</p>

              <div className="mt-5 space-y-5">
                <div id="business-logo" className="scroll-mt-8 rounded-2xl bg-[#f4f1eb] p-5">
                  <h3 className="text-sm font-semibold text-[#123b35]">Business logo</h3>
                  <div className="mt-3 flex h-36 items-center justify-center overflow-hidden rounded-xl border border-[#e2ded5] bg-gradient-to-br from-[#123b35] to-[#527866] sm:h-44">
                    {profile.logoUrl ? (
                    <Image
                      src={profile.logoUrl}
                      alt={`${profile.businessName} business logo`}
                      width={720}
                      height={352}
                      unoptimized
                      className="h-full w-full object-contain p-4"
                    />
                    ) : (
                      <span className="px-4 text-center text-2xl font-bold text-white">{profile.businessName}</span>
                    )}
                  </div>
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs leading-5 text-[#68756f]">JPEG, PNG, or WebP. Maximum file size: 5 MB.</p>
                    <label className="inline-flex cursor-pointer justify-center rounded-xl border border-[#d6dcd5] bg-[#fffdf9] px-4 py-3 text-sm font-semibold text-[#245c4c] transition hover:bg-white">
                      {uploadingImage === "logo" ? "Uploading logo…" : "Change logo"}
                      <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void uploadImage(event, "logo")} disabled={uploadingImage !== null} className="sr-only" />
                    </label>
                  </div>
                </div>

                <div className="flex flex-col gap-5 rounded-2xl bg-[#f4f1eb] p-5 sm:flex-row sm:items-center">
                  <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-[#d9a441] text-3xl font-bold text-[#123b35] shadow-md">
                    {profile.profilePictureUrl ? (
                      <Image src={profile.profilePictureUrl} alt={`${profile.businessName} profile picture`} width={96} height={96} unoptimized className="h-full w-full object-cover" />
                    ) : (
                      profile.businessName.slice(0, 1).toUpperCase()
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-[#123b35]">Profile picture</h3>
                    <p className="mt-1 text-xs leading-5 text-[#68756f]">A small round picture shown over the business logo on your dealer page.</p>
                    <label className="mt-3 inline-flex cursor-pointer rounded-xl border border-[#d6dcd5] bg-[#fffdf9] px-4 py-3 text-sm font-semibold text-[#245c4c] transition hover:bg-white">
                      {uploadingImage === "profile-picture" ? "Uploading picture…" : "Change profile picture"}
                      <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void uploadImage(event, "profile-picture")} disabled={uploadingImage !== null} className="sr-only" />
                    </label>
                  </div>
                </div>
              </div>
            </section>

            <div className="grid gap-5 border-t border-[#e9e5dc] pt-6 sm:grid-cols-2">
              <label className="block text-sm font-semibold text-[#123b35]">
                Business name
                <input value={profile.businessName} onChange={(event) => setProfile({ ...profile, businessName: event.target.value })} required minLength={2} maxLength={160} className="field mt-2" />
              </label>
              <label className="block text-sm font-semibold text-[#123b35]">
                Business phone
                <input value={profile.businessPhone} onChange={(event) => setProfile({ ...profile, businessPhone: event.target.value })} required type="tel" minLength={7} maxLength={30} className="field mt-2" />
              </label>
              <label className="block text-sm font-semibold text-[#123b35]">
                Business email
                <input value={profile.businessEmail} onChange={(event) => setProfile({ ...profile, businessEmail: event.target.value })} required type="email" className="field mt-2" />
              </label>
              <label className="block text-sm font-semibold text-[#123b35]">
                Business address
                <input value={profile.businessAddress} onChange={(event) => setProfile({ ...profile, businessAddress: event.target.value })} required minLength={5} maxLength={300} className="field mt-2" />
              </label>
            </div>

            <label className="block border-t border-[#e9e5dc] pt-6 text-sm font-semibold text-[#123b35]">
              About your business
              <textarea value={profile.description} onChange={(event) => setProfile({ ...profile, description: event.target.value })} required minLength={20} maxLength={2000} className="field mt-2 min-h-36 resize-y" />
            </label>

            {message && (
              <p role={messageIsError ? "alert" : "status"} className={`rounded-xl p-4 text-sm leading-6 ${messageIsError ? "bg-red-50 text-red-800" : "bg-[#edf4ef] text-[#245c4c]"}`}>
                {message}
              </p>
            )}

            <div className="flex flex-col-reverse gap-3 border-t border-[#e9e5dc] pt-6 sm:flex-row sm:justify-end">
              <Link href="/dashboard/dealer" className="rounded-xl border border-[#d6dcd5] px-5 py-3 text-center text-sm font-semibold text-[#245c4c] transition hover:bg-[#f4f1eb]">
                Cancel
              </Link>
              <button type="submit" disabled={saving} className="rounded-xl bg-[#d9a441] px-6 py-3 text-sm font-bold text-[#18211f] transition hover:bg-[#e7b95b] disabled:opacity-60">
                {saving ? "Saving changes…" : "Save changes"}
              </button>
            </div>
          </form>
        ) : (
          <p role="alert" className="mt-7 rounded-2xl bg-red-50 p-5 text-sm text-red-800">
            {message || "Your business profile could not be loaded."}
          </p>
        )}
      </div>
    </main>
  );
}
