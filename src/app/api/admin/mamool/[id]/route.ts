import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, logAdminActivity } from "@/lib/admin-auth";
import { validateRegimenInput } from "@/lib/mamool";

const FULL = {
  complaints: { include: { complaint: { select: { id: true, label: true, category: true } } } },
  medicines: { orderBy: { sortOrder: "asc" as const }, include: { tag: { select: { id: true, label: true, kind: true, active: true } } } },
  reviews: { orderBy: { createdAt: "desc" as const } },
  versions: { orderBy: { version: "desc" as const }, select: { version: true, approvedByName: true, reason: true, createdAt: true } },
};

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { id } = await params;
  const regimen = await db.mamoolRegimen.findUnique({ where: { id }, include: FULL });
  if (!regimen) return NextResponse.json({ error: "Regimen not found" }, { status: 404 });
  return NextResponse.json({ regimen });
}

// Edit the working copy. Editing an approved regimen starts a new version as a
// draft — clinics keep getting the approved version until this one is approved.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { id } = await params;
  const current = await db.mamoolRegimen.findUnique({ where: { id }, select: { id: true, code: true, status: true, version: true } });
  if (!current) return NextResponse.json({ error: "Regimen not found" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const { input, error } = await validateRegimenInput(body);
  if (!input) return NextResponse.json({ error }, { status: 400 });
  const by = session.admin.name;
  const version = current.status === "approved" ? current.version + 1 : current.version;
  const reason = typeof body.reason === "string" && body.reason.trim() ? body.reason.trim().slice(0, 500) : null;

  await db.$transaction(async (tx) => {
    await tx.mamoolRegimenComplaint.deleteMany({ where: { regimenId: id } });
    await tx.mamoolRegimenMedicine.deleteMany({ where: { regimenId: id } });
    await tx.mamoolRegimen.update({
      where: { id },
      data: {
        name: input.name, description: input.description, clinicalNotes: input.clinicalNotes, status: "draft", version, updatedByName: by,
        complaints: { create: input.complaints },
        medicines: { create: input.medicines.map((m, i) => ({ ...m, sortOrder: i })) },
      },
    });
    await tx.mamoolRegimenReview.create({ data: { regimenId: id, version, action: "edited", byName: by, comment: reason } });
  });
  await logAdminActivity(session.admin.id, "mamool.edited", `Edited Mamool-e-Matab regimen ${current.code} (v${version})`).catch(() => {});
  const regimen = await db.mamoolRegimen.findUnique({ where: { id }, include: FULL });
  return NextResponse.json({ regimen });
}
