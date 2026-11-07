import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/api-auth";
import { logClinicEvent } from "@/lib/clinic-audit";

// Audit only: a doctor applied a regimen to this visit's prescription (nothing is
// saved to the prescription here — the doctor still reviews and saves it).
export async function POST(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth || auth.type !== "facility") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const visit = await db.visit.findFirst({ where: { id: String(b.visitId ?? ""), facilityId: auth.id }, select: { id: true, visitCode: true } });
  if (!visit) return NextResponse.json({ error: "Visit not found" }, { status: 404 });
  const r = await db.mamoolRegimen.findUnique({ where: { id: String(b.regimenId ?? "") }, select: { id: true, code: true, name: true, approvedVersion: true, active: true } });
  if (!r || !r.active || r.approvedVersion == null) return NextResponse.json({ error: "This regimen is no longer available" }, { status: 400 });
  await logClinicEvent(req, auth, {
    action: "mamool.applied", summary: `Applied Mamool-e-Matab ${r.code} "${r.name}" (v${b.version ?? r.approvedVersion}) to visit ${visit.visitCode}`,
    entityType: "visit", entityId: visit.id, entityLabel: visit.visitCode, details: { regimenId: r.id, version: b.version ?? r.approvedVersion, added: b.added, skipped: b.skipped },
  });
  return NextResponse.json({ ok: true });
}
