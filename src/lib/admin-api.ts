"use client";

import { useAdminStore, type AdminUser } from "@/lib/admin-store";

const TOKEN_KEY = "hekims-admin-token";

function getAdminToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
}

/**
 * Stores the admin session token. When `remember` is true (default) the
 * token persists in localStorage across browser restarts; otherwise it's
 * kept in sessionStorage only and clears when the tab/browser closes.
 */
export function setAdminToken(token: string, remember: boolean = true) {
  if (typeof window === "undefined") return;
  if (remember) {
    localStorage.setItem(TOKEN_KEY, token);
    sessionStorage.removeItem(TOKEN_KEY);
  } else {
    sessionStorage.setItem(TOKEN_KEY, token);
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function clearAdminToken() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
}

async function request<T = any>(url: string, options: RequestInit = {}): Promise<T> {
  const token = getAdminToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["x-hekim-admin-auth"] = token;
  if (options.body && typeof options.body === "string" && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (data as any)?.error || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data as T;
}

export const adminApi = {
  get: <T = any>(url: string) => request<T>(url, { method: "GET" }),
  post: <T = any>(url: string, body?: any) =>
    request<T>(url, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  patch: <T = any>(url: string, body?: any) =>
    request<T>(url, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  put: <T = any>(url: string, body?: any) =>
    request<T>(url, { method: "PUT", body: body ? JSON.stringify(body) : undefined }),
};

/** On admin panel boot, restore the session from the stored token. */
export async function restoreAdminSession(): Promise<AdminUser | null> {
  const token = getAdminToken();
  if (!token) return null;
  try {
    const data = await adminApi.get<{ admin: AdminUser }>("/api/admin/auth/me");
    useAdminStore.getState().setAdmin(data.admin);
    return data.admin;
  } catch {
    clearAdminToken();
    return null;
  }
}
