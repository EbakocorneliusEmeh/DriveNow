"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";

const API_ORIGIN = "http://localhost:4000";
const API_URL = `${API_ORIGIN}/api/auth`;

type ProfileUser = {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  email: string;
  phone: string;
  role: "customer" | "dealer" | "admin";
};

type ApiResponse = {
  success: boolean;
  message?: string;
  data?: { user: ProfileUser };
};

function getAvatarSource(avatarUrl: string | null) {
  if (!avatarUrl) return "";
  return avatarUrl.startsWith("/") ? `${API_ORIGIN}${avatarUrl}` : avatarUrl;
}

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<ProfileUser | null>(null);
  const [fullName, setFullName] = useState("");
  const [selectedPicture, setSelectedPicture] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  function authorizationHeaders() {
    const token = sessionStorage.getItem("drivenow_access_token");
    return token ? { Authorization: `Bearer ${token}` } : null;
  }

  useEffect(() => {
    const headers = authorizationHeaders();
    if (!headers) {
      router.replace("/login");
      return;
    }
    const requestHeaders: HeadersInit = headers;

    async function loadProfile() {
      try {
        const response = await fetch(`${API_URL}/me`, { headers: requestHeaders });
        if (response.status === 401) {
          sessionStorage.removeItem("drivenow_access_token");
          router.replace("/login");
          return;
        }
        const result = (await response.json()) as ApiResponse;
        if (!response.ok || !result.success || !result.data?.user) {
          throw new Error(result.message ?? "Unable to load your profile");
        }
        setUser(result.data.user);
        setFullName(result.data.user.fullName);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to load your profile");
      } finally {
        setLoading(false);
      }
    }

    void loadProfile();
  }, [router]);

  useEffect(() => {
    if (!selectedPicture) {
      setPreviewUrl("");
      return;
    }
    const objectUrl = URL.createObjectURL(selectedPicture);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [selectedPicture]);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const headers = authorizationHeaders();
    if (!headers) {
      router.replace("/login");
      return;
    }

    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(`${API_URL}/me`, {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ fullName }),
      });
      const result = (await response.json()) as ApiResponse;
      if (!response.ok || !result.success || !result.data?.user) {
        throw new Error(result.message ?? "Unable to save your profile");
      }
      setUser(result.data.user);
      setFullName(result.data.user.fullName);
      setMessage("Your profile has been updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save your profile");
    } finally {
      setSaving(false);
    }
  }

  async function uploadPicture(picture: File) {
    const headers = authorizationHeaders();
    if (!headers) {
      router.replace("/login");
      return;
    }

    setUploading(true);
    setMessage("");
    try {
      const response = await fetch(`${API_URL}/me/profile-picture`, {
        method: "POST",
        headers: { ...headers, "Content-Type": picture.type },
        body: picture,
      });
      const result = (await response.json()) as ApiResponse;
      if (!response.ok || !result.success || !result.data?.user) {
        throw new Error(result.message ?? "Unable to upload your profile picture");
      }
      setUser(result.data.user);
      setSelectedPicture(null);
      setMessage("Your profile picture has been updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to upload your profile picture");
    } finally {
      setUploading(false);
    }
  }

  function choosePicture(event: ChangeEvent<HTMLInputElement>) {
    const picture = event.target.files?.[0] ?? null;
    setMessage("");
    if (picture && picture.size > 5 * 1024 * 1024) {
      setSelectedPicture(null);
      setMessage("Choose an image smaller than 5 MB.");
      event.target.value = "";
      return;
    }
    if (picture && !["image/jpeg", "image/png", "image/webp"].includes(picture.type)) {
      setSelectedPicture(null);
      setMessage("Choose a JPEG, PNG, or WebP image.");
      event.target.value = "";
      return;
    }
    setSelectedPicture(picture);
    if (picture) void uploadPicture(picture);
  }

  if (loading) {
    return <main className="min-h-screen bg-[#f4f1eb] p-8 text-center text-sm text-[#68756f]">Loading your profile…</main>;
  }

  return (
    <main className="min-h-screen bg-[#f4f1eb] px-5 py-8 text-[#18211f] sm:px-10 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <Link href="/dashboard" className="text-sm font-bold text-[#245c4c]">← Back to dashboard</Link>
        <section className="mt-7 overflow-hidden rounded-[2rem] bg-[#fffdf9] shadow-xl shadow-[#123b35]/10">
          <div className="bg-[#123b35] px-7 py-10 text-[#f4f1eb] sm:px-10">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#d9a441]">Your account</p>
            <h1 className="mt-4 text-4xl font-semibold tracking-[-0.06em] sm:text-5xl">Edit your profile.</h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-[#b8ccc5]">Update your name and profile picture. Your contact details stay protected by account verification.</p>
          </div>

          {user ? (
            <div className="grid gap-10 p-7 sm:p-10 md:grid-cols-[200px_1fr]">
              <section>
                <h2 className="text-sm font-bold text-[#123b35]">Profile picture</h2>
                <div className="mt-4 flex h-32 w-32 items-center justify-center overflow-hidden rounded-full bg-[#d9a441] text-3xl font-bold text-[#123b35]">
                  {(previewUrl || user.avatarUrl) ? (
                    <Image
                      src={previewUrl || getAvatarSource(user.avatarUrl)}
                      alt={`${user.fullName}'s profile`}
                      width={128}
                      height={128}
                      unoptimized
                      className="h-full w-full object-cover"
                    />
                  ) : user.fullName.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("")}
                </div>
                <label className="mt-5 block cursor-pointer rounded-xl border border-[#d6dcd5] px-4 py-3 text-center text-sm font-bold text-[#245c4c] transition hover:bg-[#f4f1eb]">
                  {uploading ? "Uploading picture…" : "Choose and upload picture"}
                  <input type="file" accept="image/jpeg,image/png,image/webp" onChange={choosePicture} disabled={uploading} className="sr-only" />
                </label>
                <p className="mt-2 text-xs leading-5 text-[#87928c]">JPEG, PNG, or WebP. Maximum 5 MB.</p>
                {uploading && <p role="status" className="mt-3 text-xs font-semibold text-[#245c4c]">Saving your picture to Cloudinary…</p>}
              </section>

              <form onSubmit={saveProfile} className="space-y-5">
                <label className="block text-sm font-semibold text-[#123b35]">Full name
                  <input value={fullName} onChange={(event) => setFullName(event.target.value)} required minLength={2} maxLength={120} className="field mt-2" />
                </label>
                <label className="block text-sm font-semibold text-[#123b35]">Email address
                  <input value={user.email} readOnly className="field mt-2 cursor-not-allowed bg-[#f4f1eb] text-[#68756f]" />
                  <span className="mt-2 block text-xs font-normal text-[#87928c]">Email changes will be available with verification.</span>
                </label>
                <label className="block text-sm font-semibold text-[#123b35]">Phone number
                  <input value={user.phone} readOnly className="field mt-2 cursor-not-allowed bg-[#f4f1eb] text-[#68756f]" />
                  <span className="mt-2 block text-xs font-normal text-[#87928c]">Phone changes will be available with verification.</span>
                </label>
                {message && <p role="status" className="rounded-xl bg-[#edf4ef] p-4 text-sm leading-6 text-[#245c4c]">{message}</p>}
                <button disabled={saving} className="rounded-xl bg-[#123b35] px-6 py-4 text-sm font-bold text-white transition hover:bg-[#1d5148] disabled:opacity-60">{saving ? "Saving…" : "Save changes"}</button>
              </form>
            </div>
          ) : (
            <p role="alert" className="p-8 text-sm text-[#943d22]">{message || "Unable to load your profile."}</p>
          )}
        </section>
      </div>
    </main>
  );
}
