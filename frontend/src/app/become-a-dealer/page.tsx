"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const API_URL = "http://localhost:4000/api/dealers";

type DealerProfile = {
  businessName: string;
  businessEmail: string;
  businessPhone: string;
  businessAddress: string;
  description: string;
  logoUrl: string | null;
  documentUrls: string[];
  approvalStatus: "pending" | "approved" | "rejected";
};

type ProfileResponse = {
  success: boolean;
  message?: string;
  data?: { profile: DealerProfile | null };
};

export default function BecomeADealerPage() {
  const router = useRouter();
  const [businessName, setBusinessName] = useState("");
  const [businessEmail, setBusinessEmail] = useState("");
  const [businessPhone, setBusinessPhone] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");
  const [description, setDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [documentLinks, setDocumentLinks] = useState("");
  const [status, setStatus] = useState<DealerProfile["approvalStatus"] | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

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
          router.replace("/login");
          return;
        }
        const result = (await response.json()) as ProfileResponse;
        const profile = result.data?.profile;
        if (profile) {
          setBusinessName(profile.businessName);
          setBusinessEmail(profile.businessEmail);
          setBusinessPhone(profile.businessPhone);
          setBusinessAddress(profile.businessAddress);
          setDescription(profile.description);
          setLogoUrl(profile.logoUrl ?? "");
          setDocumentLinks(profile.documentUrls.join("\n"));
          setStatus(profile.approvalStatus);
        }
      } catch {
        setMessage("Unable to load your business application. Please try again.");
      } finally {
        setLoading(false);
      }
    }

    void loadProfile();
  }, [router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const headers = authorizationHeaders();
    if (!headers) {
      router.replace("/login");
      return;
    }

    setSubmitting(true);
    setMessage("");
    const documentUrls = documentLinks
      .split("\n")
      .map((link) => link.trim())
      .filter(Boolean);

    try {
      const response = await fetch(`${API_URL}/application`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName,
          businessEmail,
          businessPhone,
          businessAddress,
          description,
          logoUrl,
          documentUrls,
        }),
      });
      const result = (await response.json()) as ProfileResponse;
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "Unable to submit your application");
      }
      setStatus("pending");
      setMessage(result.message ?? "Your application is pending review.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to submit your application");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <main className="min-h-screen bg-[#f4f1eb] p-8 text-center text-sm text-[#68756f]">Loading your business profile…</main>;
  }

  return (
    <main className="min-h-screen bg-[#f4f1eb] px-5 py-8 text-[#18211f] sm:px-10 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <Link href="/dashboard" className="text-sm font-bold text-[#245c4c]">← Back to dashboard</Link>
        <section className="mt-7 overflow-hidden rounded-[2rem] bg-[#fffdf9] shadow-xl shadow-[#123b35]/10">
          <div className="bg-[#123b35] px-7 py-10 text-[#f4f1eb] sm:px-10"><p className="text-xs font-bold uppercase tracking-[0.25em] text-[#d9a441]">DriveNow for businesses</p><h1 className="mt-4 text-4xl font-semibold tracking-[-0.06em] sm:text-5xl">Create your business page.</h1><p className="mt-4 max-w-xl text-sm leading-6 text-[#b8ccc5]">Tell customers about your business. After approval, you will be able to publish and manage vehicle listings.</p></div>
          <form onSubmit={submit} className="space-y-6 p-7 sm:p-10">
            {status && <div className={`rounded-xl p-4 text-sm ${status === "approved" ? "bg-[#e6f2e8] text-[#245c4c]" : status === "rejected" ? "bg-[#f9e5df] text-[#943d22]" : "bg-[#fff3d6] text-[#76571b]"}`}><span className="font-bold capitalize">{status}</span> — {status === "approved" ? "Your business is approved. Listing tools will be added next." : "Your application is being reviewed. You can update and resubmit these details if needed."}</div>}
            <div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-semibold text-[#123b35]">Business name<input value={businessName} onChange={(event) => setBusinessName(event.target.value)} required className="field mt-2" placeholder="e.g. Bonapriso Auto Hire" /></label><label className="block text-sm font-semibold text-[#123b35]">Business email<input value={businessEmail} onChange={(event) => setBusinessEmail(event.target.value)} required type="email" className="field mt-2" placeholder="hello@business.com" /></label><label className="block text-sm font-semibold text-[#123b35]">Business phone<input value={businessPhone} onChange={(event) => setBusinessPhone(event.target.value)} required type="tel" className="field mt-2" placeholder="+237 ..." /></label><label className="block text-sm font-semibold text-[#123b35]">Business address<input value={businessAddress} onChange={(event) => setBusinessAddress(event.target.value)} required className="field mt-2" placeholder="Street, city" /></label></div>
            <label className="block text-sm font-semibold text-[#123b35]">About your business<textarea value={description} onChange={(event) => setDescription(event.target.value)} required minLength={20} className="field mt-2 min-h-32 resize-y" placeholder="Describe your business, the vehicles you provide, and the areas you serve." /></label>
            <label className="block text-sm font-semibold text-[#123b35]">Logo link <span className="font-normal text-[#87928c]">(optional)</span><input value={logoUrl} onChange={(event) => setLogoUrl(event.target.value)} type="url" className="field mt-2" placeholder="https://..." /></label>
            <label className="block text-sm font-semibold text-[#123b35]">Business document links<textarea value={documentLinks} onChange={(event) => setDocumentLinks(event.target.value)} required className="field mt-2 min-h-28 resize-y" placeholder={"One secure document link per line\nhttps://..."} /><span className="mt-2 block text-xs font-normal leading-5 text-[#87928c]">Add at least one link to your registration or other verification document. Secure file uploads will replace document links when storage is configured.</span></label>
            {message && <p className="rounded-xl bg-[#edf4ef] p-4 text-sm leading-6 text-[#245c4c]">{message}</p>}
            <button disabled={submitting} className="rounded-xl bg-[#d9a441] px-6 py-4 text-sm font-bold text-[#18211f] transition hover:bg-[#e7b95b] disabled:opacity-60">{submitting ? "Submitting…" : status ? "Update application" : "Submit for approval"}</button>
          </form>
        </section>
      </div>
    </main>
  );
}
