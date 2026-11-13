"use client";

import { useEffect, useState, type FormEvent } from "react";
import ChatReports from "./ChatReports";

const API_URL = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api"}/admin`;

type User = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: "customer" | "dealer" | "admin";
  emailVerified: boolean;
  phoneVerified: boolean;
  createdAt: string;
};

type DealerApplication = {
  id: string;
  businessName: string;
  businessEmail: string;
  businessPhone: string;
  businessAddress: string;
  description: string;
  documentUrls: string[];
  approvalStatus: "pending" | "approved" | "rejected";
  approvalReason: string | null;
  applicantName: string;
  applicantEmail: string;
};

type VehicleReview = {
  id: string;
  make: string;
  model: string;
  year: number;
  dailyRate: number;
  location: string;
  description: string;
  imageUrls: string[];
  dealerName: string;
  dealerEmail: string;
};

type AdminDashboardData = {
  stats: {
    totalUsers: number;
    dealerApplications: number;
    pendingDealerApplications: number;
  };
  applications: DealerApplication[];
  vehicleReviews: VehicleReview[];
  users: User[];
};

type RejectTarget = {
  kind: "dealer" | "vehicle";
  id: string;
  title: string;
};

type ApiResponse = {
  success: boolean;
  message?: string;
  data?: AdminDashboardData;
};

function StatCard({ title, value }: { title: string; value: number }) {
  return (
    <div className="rounded-2xl border border-[#e2ded5] bg-[#fffdf9] p-6 shadow-sm">
      <p className="text-sm font-medium uppercase tracking-[0.18em] text-[#87928c]">{title}</p>
      <p className="mt-3 text-3xl font-bold text-[#123b35]">{value}</p>
    </div>
  );
}

export default function AdminPage() {
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [message, setMessage] = useState("Loading dashboard...");
  const [rejectTarget, setRejectTarget] = useState<RejectTarget | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [reviewError, setReviewError] = useState("");
  const [reviewing, setReviewing] = useState(false);

  async function fetchDashboardData() {
    try {
      const token = sessionStorage.getItem("drivenow_access_token");
      if (!token) {
        setMessage("You are not authorized to view this page.");
        return;
      }

      const response = await fetch(`${API_URL}/dashboard`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const result = (await response.json()) as ApiResponse;
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "Failed to fetch dashboard data.");
      }

      if (result.data) {
        setData(result.data);
        setMessage("");
      } else {
        setMessage("No data found.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "An unknown error occurred.");
    }
  }

  useEffect(() => {
    void Promise.resolve().then(fetchDashboardData);
  }, []);

  async function handleReviewApplication(applicationId: string, decision: "approved" | "rejected") {
    try {
      const token = sessionStorage.getItem("drivenow_access_token");
      const response = await fetch(`${API_URL}/dealer-applications/${applicationId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ decision }),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? `Failed to ${decision} application.`);
      }

      // Refresh data to show the change
      await fetchDashboardData();
    } catch (error) {
      alert(error instanceof Error ? error.message : "An unknown error occurred.");
    }
  }

  async function approveVehicle(vehicleId: string) {
    setReviewError("");
    try {
      const token = sessionStorage.getItem("drivenow_access_token");
      if (!token) throw new Error("Sign in again to review vehicle listings.");
      const response = await fetch(`${API_URL}/vehicle-reviews/${vehicleId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: ["Bearer", token].join(" "),
        },
        body: JSON.stringify({ decision: "approved" }),
      });
      const result = await response.json() as { success: boolean; message?: string };
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "Unable to approve vehicle listing.");
      }
      await fetchDashboardData();
    } catch (error) {
      setReviewError(error instanceof Error ? error.message : "Unable to approve vehicle listing.");
    }
  }

  async function confirmRejection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!rejectTarget || rejectReason.trim().length < 5) return;
    setReviewing(true);
    setReviewError("");
    try {
      const token = sessionStorage.getItem("drivenow_access_token");
      if (!token) throw new Error("Sign in again to review this item.");
      const path = rejectTarget.kind === "dealer"
        ? `dealer-applications/${rejectTarget.id}`
        : `vehicle-reviews/${rejectTarget.id}`;
      const response = await fetch(`${API_URL}/${path}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: ["Bearer", token].join(" "),
        },
        body: JSON.stringify({ decision: "rejected", reason: rejectReason.trim() }),
      });
      const result = await response.json() as { success: boolean; message?: string };
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? `Unable to reject ${rejectTarget.title}.`);
      }
      setRejectTarget(null);
      setRejectReason("");
      await fetchDashboardData();
    } catch (error) {
      setReviewError(error instanceof Error ? error.message : "Unable to complete this review.");
    } finally {
      setReviewing(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f4f1eb] p-8 text-[#18211f]">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex items-center justify-between gap-4 rounded-[1.5rem] bg-[#123b35] px-6 py-5 text-[#f4f1eb] shadow-sm">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#d9a441]">DriveNow</p>
            <h1 className="mt-2 text-3xl font-bold text-white">Admin Dashboard</h1>
          </div>
          <a
            href="/dashboard"
            className="rounded-xl border border-[#d9a441]/50 bg-[#d9a441] px-4 py-2 text-sm font-bold text-[#123b35] transition hover:bg-[#e7b95b]"
          >
            Back to dashboard
          </a>
        </div>
        <p className="mt-2 text-[#68756f]">Oversee users, dealer applications, and system activity.</p>

        {message && <p className="mt-8 text-center text-gray-500">{message}</p>}
        {reviewError && !rejectTarget && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-4 text-sm text-red-800">{reviewError}</p>}

        {data && (
          <>
            {/* Stats Section */}
            <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard title="Total Users" value={data.stats.totalUsers} />
              <StatCard title="Dealer Applications" value={data.stats.dealerApplications} />
              <StatCard title="Pending Applications" value={data.stats.pendingDealerApplications} />
              <StatCard title="Vehicle Reviews" value={data.vehicleReviews.length} />
            </div>

            <ChatReports />

            {/* Dealer Applications Section */}
            <div className="mt-12">
              <h2 className="text-2xl font-semibold text-gray-900">Dealer Applications</h2>
              <div className="mt-4 overflow-hidden rounded-lg bg-white shadow">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Business
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Applicant
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Documents
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {data.applications.map((app) => (
                      <tr key={app.id}>
                        <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                          {app.businessName}
                          <span className="mt-1 block text-xs font-normal text-gray-500">
                            {app.businessEmail} · {app.businessPhone}
                          </span>
                          <span className="mt-1 block max-w-xs whitespace-normal text-xs font-normal text-gray-500">
                            {app.businessAddress}
                          </span>
                          <span className="mt-1 block max-w-xs whitespace-normal text-xs font-normal text-gray-500">
                            {app.description}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                          {app.applicantName} ({app.applicantEmail})
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm">
                          <span
                            className={`rounded-full px-2 py-1 text-xs font-semibold ${
                              app.approvalStatus === "pending"
                                ? "bg-yellow-100 text-yellow-800"
                                : app.approvalStatus === "approved"
                                ? "bg-green-100 text-green-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {app.approvalStatus}
                          </span>
                          {app.approvalReason && (
                            <span className="mt-1 block max-w-xs whitespace-normal text-xs text-red-700">
                              Reason: {app.approvalReason}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {app.documentUrls.length ? (
                            <ul className="space-y-1">
                              {app.documentUrls.map((url, index) => (
                                <li key={`${url}-${index}`}>
                                  <a href={url} target="_blank" rel="noreferrer" className="font-medium text-[#245c4c] underline">
                                    View document {index + 1}
                                  </a>
                                </li>
                              ))}
                            </ul>
                          ) : <span>No documents uploaded</span>}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                          {app.approvalStatus === "pending" && (
                            <div className="flex justify-end space-x-2">
                              <button
                                onClick={() => handleReviewApplication(app.id, "approved")}
                                className="rounded bg-[#123b35] px-3 py-1 text-white hover:bg-[#245c4c]"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => {
                                  setReviewError("");
                                  setRejectReason("");
                                  setRejectTarget({ kind: "dealer", id: app.id, title: app.businessName });
                                }}
                                className="rounded bg-[#943d22] px-3 py-1 text-white hover:bg-[#a94e34]"
                              >
                                Reject
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <section className="mt-12" aria-labelledby="vehicle-reviews-heading">
              <h2 id="vehicle-reviews-heading" className="text-2xl font-semibold text-gray-900">Vehicle listings awaiting review</h2>
              <p className="mt-1 text-sm text-gray-600">Approved listings go live immediately; rejected listings stay as drafts and include your feedback.</p>
              {data.vehicleReviews.length === 0 ? (
                <p className="mt-4 rounded-lg bg-white p-6 text-sm text-gray-500">No vehicle listings are waiting for review.</p>
              ) : (
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  {data.vehicleReviews.map((vehicle) => (
                    <article key={vehicle.id} className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                      {vehicle.imageUrls[0] && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={vehicle.imageUrls[0]} alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`} className="h-52 w-full object-cover" />
                      )}
                      <div className="p-5">
                        <h3 className="font-semibold text-gray-900">{vehicle.year} {vehicle.make} {vehicle.model}</h3>
                        <p className="mt-1 text-sm text-gray-600">{vehicle.dealerName} · {vehicle.dealerEmail}</p>
                        <p className="mt-3 text-sm text-gray-700">{vehicle.location} · {vehicle.dailyRate.toLocaleString()} FCFA/day</p>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-600">{vehicle.description}</p>
                        {vehicle.imageUrls.length > 1 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {vehicle.imageUrls.slice(1).map((url, index) => (
                              <a key={`${url}-${index}`} href={url} target="_blank" rel="noreferrer" className="text-xs font-medium text-[#245c4c] underline">
                                View photo {index + 2}
                              </a>
                            ))}
                          </div>
                        )}
                        <div className="mt-4 flex justify-end gap-2 border-t border-gray-100 pt-4">
                          <button
                            type="button"
                            onClick={() => void approveVehicle(vehicle.id)}
                            className="rounded bg-[#123b35] px-3 py-2 text-sm font-semibold text-white hover:bg-[#245c4c]"
                          >
                            Approve &amp; publish
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setReviewError("");
                              setRejectReason("");
                              setRejectTarget({
                                kind: "vehicle",
                                id: vehicle.id,
                                title: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
                              });
                            }}
                            className="rounded bg-[#943d22] px-3 py-2 text-sm font-semibold text-white hover:bg-[#7f3627]"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            {/* All Users Section */}
            <div className="mt-12">
              <h2 className="text-2xl font-semibold text-gray-900">All Users</h2>
              <div className="mt-4 overflow-hidden rounded-lg bg-white shadow">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Contact
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Role
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Verified
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {data.users.map((user) => (
                      <tr key={user.id}>
                        <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                          {user.fullName}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                          {user.email}
                          <br />
                          {user.phone}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">{user.role}</td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                          {user.emailVerified && user.phoneVerified ? "Yes" : "No"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
      {rejectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="reject-dialog-title"
            onSubmit={(event) => void confirmRejection(event)}
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
          >
            <h2 id="reject-dialog-title" className="text-xl font-semibold text-gray-900">
              Reject {rejectTarget.title}
            </h2>
            <p className="mt-2 text-sm text-gray-600">Give clear, actionable feedback so they know what to correct.</p>
            <label className="mt-4 block text-sm font-medium text-gray-700">
              Rejection reason
              <textarea
                required
                minLength={5}
                maxLength={1000}
                value={rejectReason}
                onChange={(event) => setRejectReason(event.target.value)}
                rows={4}
                className="mt-2 block w-full rounded-lg border border-gray-300 p-3 text-sm"
                placeholder="Explain what needs to be updated..."
              />
            </label>
            {reviewError && <p role="alert" className="mt-3 text-sm text-red-700">{reviewError}</p>}
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setRejectTarget(null);
                  setReviewError("");
                }}
                disabled={reviewing}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={reviewing || rejectReason.trim().length < 5}
                className="rounded-lg bg-[#943d22] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {reviewing ? "Rejecting…" : "Confirm rejection"}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}