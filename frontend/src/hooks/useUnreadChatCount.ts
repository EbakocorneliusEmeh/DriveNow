"use client";

import { useCallback, useEffect, useState } from "react";
import { io } from "socket.io-client";

const API_URL = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api"}/chat`;
const SOCKET_URL = new URL(API_URL).origin;

export function useUnreadChatCount(enabled: boolean) {
  const [count, setCount] = useState(0);
  const [error, setError] = useState("");

  const loadUnreadCount = useCallback(async () => {
    const token = sessionStorage.getItem("drivenow_access_token");
    if (!token) return;
    const response = await fetch(API_URL, {
      cache: "no-store",
      headers: { Authorization: `Bearer ${token}` },
    });
    const result = await response.json() as {
      success: boolean;
      message?: string;
      data?: { conversations: Array<{ unreadCount: number }> };
    };
    if (!response.ok || !result.success || !result.data) {
      throw new Error(result.message ?? "Could not load unread messages.");
    }
    setCount(result.data.conversations.reduce((total, item) => total + item.unreadCount, 0));
    setError("");
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const token = sessionStorage.getItem("drivenow_access_token");
    if (!token) return;

    const refresh = () => {
      void loadUnreadCount().catch((caughtError) => {
        setError(caughtError instanceof Error ? caughtError.message : "Could not load unread messages.");
      });
    };
    refresh();

    const socket = io(SOCKET_URL, { auth: { token }, transports: ["websocket", "polling"] });
    socket.on("chat:inbox-updated", refresh);
    return () => {
      socket.disconnect();
    };
  }, [enabled, loadUnreadCount]);

  return { count, error };
}
