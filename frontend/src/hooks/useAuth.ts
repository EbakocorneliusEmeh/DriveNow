"use client";

import { useCallback, useEffect, useState } from "react";

const API_URL = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api"}/auth`;

type AuthUser = {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  role: "customer" | "dealer" | "admin";
};

type ProfileResponse = {
  success: boolean;
  message?: string;
  data?: { user: AuthUser };
};

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const token = sessionStorage.getItem("drivenow_access_token");
      if (!token) {
        setUser(null);
        return;
      }

      const response = await fetch(`${API_URL}/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = (await response.json()) as ProfileResponse;

      if (!response.ok || !result.success || !result.data?.user) {
        throw new Error(result.message ?? "Unable to load your account.");
      }

      setUser(result.data.user);
    } catch (caughtError) {
      console.error("Error loading authenticated user:", caughtError);
      setUser(null);
      setError(caughtError instanceof Error ? caughtError.message : "Unable to load your account.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(refetch);
  }, [refetch]);

  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === "drivenow_access_token") {
        void refetch();
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [refetch]);

  return { user, role: user?.role ?? null, isLoading, error, refetch };
}
