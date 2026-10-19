import { db } from "@/lib/db";
import { compareLabels } from "@/lib/sort-options";

// The admin-managed chief complaint list, shared by the admin editor and the
// facility screens (L1 Screening and Main Complaints).
export async function getScreeningConfig() {
  const complaints = await db.chiefComplaint.findMany({
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
    select: { id: true, key: true, label: true, labelLocal: true, category: true, sortOrder: true, active: true },
  });
  // A–Z within each category (categories A–Z too).
  complaints.sort((a, b) => compareLabels(a.category ?? "", b.category ?? "") || compareLabels(a.label, b.label));
  return { complaints };
}

export type ScreeningConfig = Awaited<ReturnType<typeof getScreeningConfig>>;
