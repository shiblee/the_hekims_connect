"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  avatarColor: string;
  avatarImage: string | null;
}

interface AdminState {
  admin: AdminUser | null;
  setAdmin: (a: AdminUser | null) => void;
  logout: () => void;
}

export const useAdminStore = create<AdminState>()(
  persist(
    (set) => ({
      admin: null,
      setAdmin: (admin) => set({ admin }),
      logout: () => {
        localStorage.removeItem("hekims-admin-token");
        set({ admin: null });
      },
    }),
    { name: "hekims-admin-store" }
  )
);
