import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, logAdminActivity } from "@/lib/admin-auth";
import { nextRegimenCode, validateRegimenInput } from "@/lib/mamool";

// Admin → Mamool-e-Matab: list and create Treatment Regimens.
export async function GET(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const rows = await db.mamoolRegimen.findMany({
    orderBy: { updatedAt: "desc" },
    include: { complaints: { include: { complaint: { select: { label: true } } } }, _count: { select: { medicines: true } } },
  });
  return NextResponse.json({
    regimens: rows.map((r) => ({
      id: r.id, code: r.code, name: r.name, status: r.status, active: r.active, version: r.version, approvedVersion: r.approvedVersion,
      complaints: r.complaints.map((c) => c.complaint.label).sort(), medicines: r._count.medicines,
      createdByName: r.createdByName, updatedByName: r.updatedByName, updatedAt: r.updatedAt,
    })),
  });
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { input, error } = await validateRegimenInput(await req.json().catch(() => ({})));
  if (!input) return NextResponse.json({ error }, { status: 400 });
  const by = session.admin.name;
  const regimen = await db.$transaction(async (tx) => {
    const r = await tx.mamoolRegimen.create({
      data: {
        code: await nextRegimenCode(), name: input.name, description: input.description, clinicalNotes: input.clinicalNotes, createdByName: by, updatedByName: by,
        complaints: { create: input.complaints },
        medicines: { create: input.medicines.map((m, i) => ({ ...m, sortOrder: i })) },
      },
    });
    await tx.mamoolRegimenReview.create({ data: { regimenId: r.id, version: 1, action: "created", byName: by } });
    return r;
  });
  await logAdminActivity(session.admin.id, "mamool.created", `Created Mamool-e-Matab regimen ${regimen.code} "${regimen.name}"`).catch(() => {});
  return NextResponse.json({ regimen });
}
