"use client";

import { useEffect, useState } from "react";
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
  approvalStatus: "pending" | "approved" | "rejected";
  applicantName: string;
  applicantEmail: string;
};

type AdminDashboardData = {
  stats: {
    totalUsers: number;
    dealerApplications: number;
    pendingDealerApplications: number;
  };
  applications: DealerApplication[];
  users: User[];
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
    fetchDashboardData();
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

        {data && (
          <>
            {/* Stats Section */}
            <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <StatCard title="Total Users" value={data.stats.totalUsers} />
              <StatCard title="Dealer Applications" value={data.stats.dealerApplications} />
              <StatCard title="Pending Applications" value={data.stats.pendingDealerApplications} />
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
                        Business Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Applicant
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Status
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
                                onClick={() => handleReviewApplication(app.id, "rejected")}
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
    </main>
  );
}