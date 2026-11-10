"use client";

import { useEffect } from "react";
import { io } from "socket.io-client";
import { useAuth } from "@/hooks/useAuth";
import { listenForForegroundNotifications } from "@/lib/firebase-messaging";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";
const SOCKET_URL = new URL(API_URL).origin;

export default function Notifications() {
  const { user, isLoading } = useAuth();
  const userId = user?.id;

  useEffect(() => {
    listenForForegroundNotifications();
  }, []);

  useEffect(() => {
    if (isLoading || !userId) return;

    const token = sessionStorage.getItem("drivenow_access_token");
    if (!token) return;

    const socket = io(SOCKET_URL, { auth: { token }, transports: ["websocket", "polling"] });
    socket.on("chat:incoming", (input: { conversationId: string; messageId: string }) => {
      socket.emit("chat:delivered", input);
    });
    return () => {
      socket.disconnect();
    };
  }, [isLoading, userId]);

  return null;
}
