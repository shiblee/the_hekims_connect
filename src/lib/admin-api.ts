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
  delete: <T = any>(url: string) => request<T>(url, { method: "DELETE" }),
};

/** Multipart upload with progress (XHR — fetch can't report upload progress). */
export function adminUpload<T = any>(url: string, form: FormData, onProgress?: (fraction: number) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    const token = getAdminToken();
    if (token) xhr.setRequestHeader("x-hekim-admin-auth", token);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress?.(e.loaded / e.total); };
    xhr.onload = () => {
      let data: any = {};
      try { data = JSON.parse(xhr.responseText); } catch { /* not JSON */ }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data as T);
      else reject(new Error(data?.error || (xhr.status === 413 ? "The file is too large." : `Upload failed (${xhr.status})`)));
    };
    xhr.onerror = () => reject(new Error("Upload failed — check the connection and try again."));
    xhr.send(form);
  });
}

/** Downloads a protected file (e.g. a book PDF) with the admin token. */
export async function adminFetchBlob(url: string): Promise<Blob> {
  const token = getAdminToken();
  const res = await fetch(url, { headers: token ? { "x-hekim-admin-auth": token } : {} });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as any)?.error || `Request failed (${res.status})`);
  }
  return res.blob();
}

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
