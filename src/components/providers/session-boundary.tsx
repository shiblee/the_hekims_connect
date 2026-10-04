"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { restoreSession } from "@/lib/api";

const SessionReadyContext = createContext(false);

/**
 * Runs the one-time session restore for the whole app (not just "/"), so that
 * a logged-in facility/patient/staff member landing directly on a deep URL
 * (e.g. /facility/patients) still gets their session hydrated before the
 * route's own auth guard runs.
 */
export function SessionBoundary({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    restoreSession().finally(() => setReady(true));
  }, []);

  return <SessionReadyContext.Provider value={ready}>{children}</SessionReadyContext.Provider>;
}

export function useSessionReady() {
  return useContext(SessionReadyContext);
}
