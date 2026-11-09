"use client";

import { useEffect } from "react";
import { listenForForegroundNotifications } from "@/lib/firebase-messaging";

export default function Notifications() {
  useEffect(() => {
    listenForForegroundNotifications();
  }, []);

  return null;
}