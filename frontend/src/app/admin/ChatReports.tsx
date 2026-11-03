"use client";

import { useCallback, useEffect, useState } from "react";

const API_URL = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api"}/admin/chat-reports`;

type Report = {
  conversationId: string;
  bookingId: string;
  reportReason: string | null;
  reportedAt: string | null;
  reportedById: string | null;
  make: string;
  model: string;
  year: number;
  customerName: string;
  dealerName: string;
};

type ReportMessage = {
  id: string;
  senderId: string;
  senderName: string;
  body: string;
  createdAt: string;
};

type ReviewedConversation = Report & {
  messages: ReportMessage[];
};

export default function ChatReports() {
  const [reports, setReports] = useState<Report[]>([]);
  const [selected, setSelected] = useState<ReviewedConversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [openingId, setOpeningId] = useState("");
  const [error, setError] = useState("");

  const loadReports = useCallback(async () => {
    const token = sessionStorage.getItem("drivenow_access_token");
    if (!token) {
      setLoading(false);
      setError("Sign in as an admin to review reported chats.");
      return;
    }

    try {
      const response = await fetch(API_URL, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json() as {
        success: boolean;
        message?: string;
        data?: { reports: Report[] };
      };
      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.message ?? "Unable to load reported chats.");
      }
      setReports(result.data.reports);
      setError("");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to load reported chats.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(loadReports);
  }, [loadReports]);

  async function reviewReport(conversationId: string) {
    const token = sessionStorage.getItem("drivenow_access_token");
    if (!token) {
      setError("Sign in as an admin to review this conversation.");
      return;
    }

    setOpeningId(conversationId);
    setError("");
    try {
      const response = await fetch(`${API_URL}/${conversationId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json() as {
        success: boolean;
        message?: string;
        data?: { conversation: ReviewedConversation };
      };
      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.message ?? "Unable to review this conversation.");
      }
      setSelected(result.data.conversation);
      setReports((current) => current.filter((report) => report.conversationId !== conversationId));
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to review this conversation.");
    } finally {
      setOpeningId("");
    }
  }

  return (
    <section id="chat-reports" className="mt-12 scroll-mt-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Reported conversations</h2>
          <p className="mt-1 text-sm text-gray-600">Private chats appear here only after a participant reports a problem. Each review is logged.</p>
        </div>
        <button type="button" onClick={() => { setLoading(true); void loadReports(); }} disabled={loading} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 disabled:opacity-60">
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>
      {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      {loading ? (
        <p role="status" className="mt-4 rounded-lg bg-white p-6 text-sm text-gray-500">Loading reports…</p>
      ) : reports.length === 0 ? (
        <p className="mt-4 rounded-lg bg-white p-6 text-sm text-gray-500">No unreviewed chat reports.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {reports.map((report) => (
            <article key={report.conversationId} className="flex flex-wrap items-center justify-between gap-4 rounded-lg bg-white p-5 shadow">
              <div>
                <h3 className="font-semibold text-gray-900">{report.year} {report.make} {report.model}</h3>
                <p className="mt-1 text-sm text-gray-600">Customer: {report.customerName} · Dealer: {report.dealerName}</p>
                <p className="mt-2 text-sm text-gray-800">Reason: {report.reportReason}</p>
                <p className="mt-1 text-xs text-gray-500">Reported {report.reportedAt ? new Date(report.reportedAt).toLocaleString() : ""}</p>
              </div>
              <button type="button" onClick={() => void reviewReport(report.conversationId)} disabled={openingId === report.conversationId} className="rounded-lg bg-[#123b35] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">
                {openingId === report.conversationId ? "Opening…" : "Review chat"}
              </button>
            </article>
          ))}
        </div>
      )}

      {selected && (
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-bold text-gray-900">Review logged: {selected.year} {selected.make} {selected.model}</h3>
              <p className="mt-1 text-sm text-gray-700">Customer: {selected.customerName} · Dealer: {selected.dealerName}</p>
              <p className="mt-2 text-sm text-gray-800">Report reason: {selected.reportReason}</p>
            </div>
            <button type="button" onClick={() => setSelected(null)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700">Close</button>
          </div>
          <div className="mt-4 max-h-96 space-y-3 overflow-y-auto rounded-lg bg-white p-4">
            {selected.messages.length ? selected.messages.map((message) => (
              <article key={message.id} className="border-b border-gray-100 pb-3 last:border-0">
                <div className="flex flex-wrap justify-between gap-2">
                  <p className="text-sm font-bold text-gray-900">{message.senderName}</p>
                  <time className="text-xs text-gray-500">{new Date(message.createdAt).toLocaleString()}</time>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-gray-700">{message.body}</p>
              </article>
            )) : <p className="text-sm text-gray-500">No messages were sent in this conversation.</p>}
          </div>
        </div>
      )}
    </section>
  );
}
