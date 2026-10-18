import { db } from "@/lib/db";

// The admin-managed chief complaint list, shared by the admin editor and the
// facility screens (L1 Screening and Main Complaints).
export async function getScreeningConfig() {
  const complaints = await db.chiefComplaint.findMany({
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
    select: { id: true, key: true, label: true, labelLocal: true, category: true, sortOrder: true, active: true },
  });
  return { complaints };
}

export type ScreeningConfig = Awaited<ReturnType<typeof getScreeningConfig>>;
