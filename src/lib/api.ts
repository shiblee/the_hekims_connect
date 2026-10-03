"use client";

import { toast } from "sonner";
import { useAppStore } from "@/lib/store";

const TOKEN_KEY = "hekims-connect-token";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
}

async function request<T = any>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  // Attach auth token if present
  if (token) {
    headers["x-hekim-auth"] = token;
  }

  // Set JSON content-type for JSON bodies
  if (options.body && typeof options.body === "string" && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  // A previously-valid token can stop working mid-session (e.g. an admin
  // suspended the account) — when that happens, force the user back to the
  // login screen immediately rather than leaving them on a broken dashboard.
  if (res.status === 401 && token) {
    useAppStore.getState().logout();
    toast.error("Your session has ended. Please log in again.");
  }

  if (!res.ok) {
    const msg = (data as any)?.error || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data as T;
}

export const api = {
  get: <T = any>(url: string) => request<T>(url, { method: "GET" }),
  post: <T = any>(url: string, body?: any) =>
    request<T>(url, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    }),
  put: <T = any>(url: string, body: any) =>
    request<T>(url, { method: "PUT", body: JSON.stringify(body) }),
  patch: <T = any>(url: string, body: any) =>
    request<T>(url, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T = any>(url: string) => request<T>(url, { method: "DELETE" }),
  upload: <T = any>(url: string, formData: FormData) =>
    request<T>(url, { method: "POST", body: formData }),
};

/** On app boot, restore the session from the stored token. */
export async function restoreSession() {
  const token = getToken();
  if (!token) return null;
  try {
    const data = await api.get<{ user: any; role: "facility" | "patient" }>(
      "/api/auth/me"
    );
    const { setFacility, setPatient, setView } = useAppStore.getState();
    if (data.role === "facility") {
      setFacility(data.user);
      setView(data.user.profileCompleted ? "facility-dashboard" : "facility-profile-setup");
    } else {
      setPatient(data.user);
      setView("patient-dashboard");
    }
    return data;
  } catch {
    useAppStore.getState().logout();
    return null;
  }
}
