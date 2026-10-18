import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";

/** Lists a Dala'il question can be linked to: complaint categories & complaints, other symptoms, body regions. */
export async function GET(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const [complaints, symptoms, regions] = await Promise.all([
    db.chiefComplaint.findMany({ where: { active: true }, orderBy: [{ category: "asc" }, { label: "asc" }], select: { key: true, label: true, category: true } }),
    db.acuteSymptomTag.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" }, select: { label: true } }),
    db.anatomicalRegionTag.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" }, select: { label: true } }),
  ]);
  return NextResponse.json({
    categories: [...new Set(complaints.map((c) => c.category))],
    complaints,
    symptoms: symptoms.map((s) => s.label),
    regions: regions.map((r) => r.label),
  });
}
