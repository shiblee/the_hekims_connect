import { db } from "@/lib/db";
import {
  DEFAULT_NORMAL_RANGES, DEFAULT_ENTRY_BOUNDS, VITALS_RANGE_FIELDS, type VitalsRangeConfig,
} from "@/lib/vitals-ranges";

// Server-only — reads the admin-configured overrides (Admin → Settings →
// Vitals Validation) out of the generic PortalSetting table, falling back
// to the hardcoded defaults for any field the admin hasn't set yet.
export async function getVitalsRangeConfig(): Promise<VitalsRangeConfig> {
  const rows = await db.portalSetting.findMany({ where: { category: "vitals_validation" } });
  const map = new Map(rows.map((r) => [r.key, r.value]));

  const normalRanges: Record<string, [number, number]> = {};
  const entryBounds: Record<string, [number, number]> = {};

  for (const field of VITALS_RANGE_FIELDS) {
    const nMin = parseFloat(map.get(`${field}_normal_min`) ?? "");
    const nMax = parseFloat(map.get(`${field}_normal_max`) ?? "");
    normalRanges[field] = Number.isFinite(nMin) && Number.isFinite(nMax) ? [nMin, nMax] : DEFAULT_NORMAL_RANGES[field];

    const eMin = parseFloat(map.get(`${field}_entry_min`) ?? "");
    const eMax = parseFloat(map.get(`${field}_entry_max`) ?? "");
    entryBounds[field] = Number.isFinite(eMin) && Number.isFinite(eMax) ? [eMin, eMax] : DEFAULT_ENTRY_BOUNDS[field];
  }

  return { normalRanges, entryBounds };
}
