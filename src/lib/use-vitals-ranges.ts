"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { DEFAULT_VITALS_RANGE_CONFIG, type VitalsRangeConfig } from "@/lib/vitals-ranges";

// Loads the admin-configured vitals validation ranges once, rendering with
// the hardcoded defaults in the meantime so the form never blocks on it.
// Takes an optional apiClient so admin call sites (adminApi, its own auth
// header) still resolve the real config instead of silently 401ing.
export function useVitalsRangeConfig(
  apiClient: { get: <T = any>(url: string) => Promise<T> } = api
): VitalsRangeConfig {
  const [config, setConfig] = useState<VitalsRangeConfig>(DEFAULT_VITALS_RANGE_CONFIG);

  useEffect(() => {
    apiClient.get<VitalsRangeConfig>("/api/facility/vitals/validation-config")
      .then(setConfig)
      .catch(() => {});
    // Intentionally runs once per mount — apiClient is a stable prop/default, not reactive state.
  }, []);

  return config;
}
