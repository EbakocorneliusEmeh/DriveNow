"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const API_URL = "http://localhost:4000/api/admin";

type ApplicationStatus = "pending" | "approved" | "rejected";
type AdminSection = "overview" | "customers" | "applications";

type DealerApplication = {
  id: string;
  businessName: string;
  businessEmail: string;
  businessPhone: string;
  businessAddress: string;
  description: string;
  documentUrls: string[];
  approvalStatus: ApplicationStatus;
  updatedAt: string;
  applicantName: string;
  applicantEmail: string;
};

type PlatformUser = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: "customer" | "dealer" | "admin";
  emailVerified: boolean;
  phoneVerified: boolean;
  createdAt: string;
};

type DashboardResponse = {
  success: boolean;
  message?: string;
  data?: {
    stats: { totalUsers: number; dealerApplications: number; pendingDealerApplications: number };
    applications: DealerApplication[];
    users: PlatformUser[];
  };
};

const statusStyles: Record<ApplicationStatus, string> = {
  pending: "bg-[#fff3d6] text-[#76571b]",
  approved: "bg-[#e6f2e8] text-[#245c4c]",
  rejected: "bg-[#f9e5df] text-[#943d22]",
};

export default function AdminPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardResponse["data"]>();
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<AdminSection>("overview");

  function headers() {
    const token = sessionStorage.getItem("drivenow_access_token");
    return token ? { Authorization: `Bearer ${token}` } : null;
  }

  useEffect(() => {
    const authorization = headers();
    if (!authorization) {
      router.replace("/login");
      return;
    }

    async function loadDashboard() {
      try {
        const response = await fetch(`${API_URL}/dashboard`, { headers: authorization });
        if (response.status === 401) {
          sessionStorage.removeItem("drivenow_access_token");
          router.replace("/login");
          return;
        }
        if (response.status === 403) {
          setMessage("This page is only available to administrators.");
          return;
        }
        const result = (await response.json()) as DashboardResponse;
        if (!response.ok || !result.success || !result.data) {
          throw new Error(result.message ?? "Unable to load the admin dashboard");
        }
        setData(result.data);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to load the admin dashboard");
      } finally {
        setLoading(false);
      }
    }

    void loadDashboard();
  }, [router]);

  async function reviewApplication(applicationId: string, decision: "approved" | "rejected") {
    const authorization = headers();
    if (!authorization) return;
    setUpdatingId(applicationId);
    setMessage("");

    try {
      const response = await fetch(`${API_URL}/dealer-applications/${applicationId}`, {
        method: "PATCH",
        headers: { ...authorization, "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      const result = (await response.json()) as DashboardResponse;
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "Unable to update the application");
      }
      setMessage(`Application ${decision}. The user becomes a dealer after approval.`);
      setData((currentData) => {
        if (!currentData) return currentData;
        const currentApplication = currentData.applications.find((application) => application.id === applicationId);
        const pendingDelta = currentApplication?.approvalStatus === "pending" ? -1 : 0;
        return {
          stats: {
            ...currentData.stats,
            pendingDealerApplications: currentData.stats.pendingDealerApplications + pendingDelta,
          },
          applications: currentData.applications.map((application) =>
            application.id === applicationId
              ? { ...application, approvalStatus: decision }
              : application,
          ),
          users: currentData.users.map((user) =>
            user.email === currentApplication?.applicantEmail && decision === "approved"
              ? { ...user, role: "dealer" }
              : user,
          ),
        };
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update the application");
    } finally {
      setUpdatingId(null);
    }
  }

  if (loading) {
    return <main className="min-h-screen bg-[#f4f1eb] p-8 text-center text-sm text-[#68756f]">Loading admin dashboard…</main>;
  }

  if (!data) {
    return <main className="min-h-screen bg-[#f4f1eb] p-8 text-center text-sm text-[#68756f]"><p>{message || "Admin dashboard unavailable."}</p><Link href="/dashboard" className="mt-4 inline-block font-bold text-[#245c4c]">Back to dashboard</Link></main>;
  }

  return (
    <main className="min-h-screen bg-[#f4f1eb] px-5 py-8 text-[#18211f] sm:px-10 sm:py-12">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.25em] text-[#c28d27]">Platform administration</p><h1 className="mt-2 text-4xl font-semibold tracking-[-0.06em] text-[#123b35]">Admin dashboard</h1></div><Link href="/dashboard" className="rounded-xl border border-[#d6dcd5] bg-[#fffdf9] px-4 py-3 text-sm font-bold text-[#245c4c]">Customer dashboard</Link></div>

        <nav className="mt-8 flex flex-wrap gap-2 rounded-2xl bg-[#e9e5dc] p-2"><button type="button" onClick={() => setActiveSection("overview")} className={`rounded-xl px-4 py-3 text-sm font-bold transition ${activeSection === "overview" ? "bg-[#fffdf9] text-[#123b35] shadow-sm" : "text-[#68756f]"}`}>Overview</button><button type="button" onClick={() => setActiveSection("customers")} className={`rounded-xl px-4 py-3 text-sm font-bold transition ${activeSection === "customers" ? "bg-[#fffdf9] text-[#123b35] shadow-sm" : "text-[#68756f]"}`}>Registered customers <span className="ml-1 text-xs">{data.stats.totalUsers}</span></button><button type="button" onClick={() => setActiveSection("applications")} className={`rounded-xl px-4 py-3 text-sm font-bold transition ${activeSection === "applications" ? "bg-[#fffdf9] text-[#123b35] shadow-sm" : "text-[#68756f]"}`}>Dealer applications <span className="ml-1 text-xs">{data.stats.pendingDealerApplications}</span></button></nav>

        {message && <p className="mb-6 rounded-xl bg-[#edf4ef] p-4 text-sm text-[#245c4c]">{message}</p>}
        {activeSection === "overview" && <section className="grid gap-4 py-8 sm:grid-cols-3"><article className="rounded-2xl bg-[#fffdf9] p-5"><p className="text-xs text-[#87928c]">Total users</p><p className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-[#123b35]">{data.stats.totalUsers}</p><p className="mt-1 text-xs text-[#245c4c]">Registered customer and staff accounts</p></article><article className="rounded-2xl bg-[#d9a441] p-5"><p className="text-xs text-[#76571b]">Dealer applications</p><p className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-[#123b35]">{data.stats.dealerApplications}</p><p className="mt-1 text-xs text-[#76571b]">Businesses submitted for the platform</p></article><article className="rounded-2xl bg-[#e4ded2] p-5"><p className="text-xs text-[#7c6949]">Awaiting review</p><p className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-[#123b35]">{data.stats.pendingDealerApplications}</p><p className="mt-1 text-xs text-[#7c6949]">Dealer applications requiring a decision</p></article></section>}
        {activeSection === "customers" && <section className="mt-6 overflow-hidden rounded-2xl bg-[#fffdf9]"><div className="border-b border-[#e9e5dc] px-6 py-5"><h2 className="text-xl font-semibold tracking-[-0.04em] text-[#123b35]">Registered customers</h2><p className="mt-1 text-sm text-[#68756f]">{data.users.length} registered account{data.users.length === 1 ? "" : "s"} on DriveNow.</p></div><div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-[#f7f4ee] text-xs uppercase tracking-[0.12em] text-[#68756f]"><tr><th className="px-6 py-4 font-bold">User</th><th className="px-6 py-4 font-bold">Contact</th><th className="px-6 py-4 font-bold">Role</th><th className="px-6 py-4 font-bold">Verification</th><th className="px-6 py-4 font-bold">Joined</th></tr></thead><tbody className="divide-y divide-[#e9e5dc]">{data.users.map((user) => <tr key={user.id}><td className="px-6 py-4"><p className="font-semibold text-[#123b35]">{user.fullName}</p><p className="mt-1 text-xs text-[#87928c]">{user.email}</p></td><td className="px-6 py-4 text-[#52605a]">{user.phone}</td><td className="px-6 py-4"><span className="rounded-full bg-[#e9eee7] px-3 py-1 text-xs font-bold capitalize text-[#245c4c]">{user.role}</span></td><td className="px-6 py-4"><p className={user.emailVerified ? "text-[#245c4c]" : "text-[#943d22]"}>Email {user.emailVerified ? "verified" : "not verified"}</p><p className={user.phoneVerified ? "mt-1 text-[#245c4c]" : "mt-1 text-[#943d22]"}>Phone {user.phoneVerified ? "verified" : "not verified"}</p></td><td className="px-6 py-4 whitespace-nowrap text-[#68756f]">{new Date(user.createdAt).toLocaleDateString()}</td></tr>)}</tbody></table></div></section>}
        {activeSection === "applications" && <section className="mt-6 overflow-hidden rounded-2xl bg-[#fffdf9]"><div className="border-b border-[#e9e5dc] px-6 py-5"><h2 className="text-xl font-semibold tracking-[-0.04em] text-[#123b35]">Dealer application review</h2><p className="mt-1 text-sm text-[#68756f]">Approve verified businesses before they can create vehicle listings.</p></div><div className="divide-y divide-[#e9e5dc]">{data.applications.length === 0 ? <p className="p-8 text-center text-sm text-[#68756f]">No dealer applications have been submitted yet.</p> : data.applications.map((application) => <article key={application.id} className="p-6"><div className="flex flex-col justify-between gap-4 lg:flex-row"><div><div className="flex flex-wrap items-center gap-3"><h3 className="font-semibold text-[#123b35]">{application.businessName}</h3><span className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${statusStyles[application.approvalStatus]}`}>{application.approvalStatus}</span></div><p className="mt-2 text-sm text-[#68756f]">Submitted by {application.applicantName} · {application.applicantEmail}</p><p className="mt-1 text-sm text-[#68756f]">{application.businessEmail} · {application.businessPhone} · {application.businessAddress}</p><p className="mt-4 max-w-3xl text-sm leading-6 text-[#52605a]">{application.description}</p>{application.documentUrls.length > 0 && <div className="mt-4 flex flex-wrap gap-3">{application.documentUrls.map((url, index) => <a key={url} href={url} target="_blank" rel="noreferrer" className="text-xs font-bold text-[#245c4c] underline">Document {index + 1} ↗</a>)}</div>}</div>{application.approvalStatus === "pending" && <div className="flex shrink-0 gap-3"><button type="button" disabled={updatingId === application.id} onClick={() => reviewApplication(application.id, "rejected")} className="rounded-xl border border-[#dfb4a8] px-4 py-3 text-sm font-bold text-[#943d22] disabled:opacity-60">Reject</button><button type="button" disabled={updatingId === application.id} onClick={() => reviewApplication(application.id, "approved")} className="rounded-xl bg-[#123b35] px-4 py-3 text-sm font-bold text-white disabled:opacity-60">{updatingId === application.id ? "Saving…" : "Approve"}</button></div>}</div></article>)}</div></section>}
      </div>
    </main>
  );
}
