import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, logAdminActivity } from "@/lib/admin-auth";
import { buildSnapshot, nextRegimenCode, readinessProblems } from "@/lib/mamool";

// submit (for clinical approval) · approve · reject · activate · deactivate · duplicate
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  const action = String(b.action ?? "");
  const comment = typeof b.comment === "string" && b.comment.trim() ? b.comment.trim().slice(0, 1000) : null;
  const by = session.admin.name;
  const r = await db.mamoolRegimen.findUnique({ where: { id }, include: { complaints: true, medicines: { orderBy: { sortOrder: "asc" } } } });
  if (!r) return NextResponse.json({ error: "Regimen not found" }, { status: 404 });
  const log = (a: string, c: string | null = comment, v = r.version) => db.mamoolRegimenReview.create({ data: { regimenId: id, version: v, action: a, byName: by, comment: c } });
  const fail = (error: string) => NextResponse.json({ error }, { status: 400 });

  if (action === "submit") {
    if (r.status !== "draft" && r.status !== "rejected") return fail("Only a draft or rejected regimen can be sent for approval");
    const problems = readinessProblems(r);
    if (problems.length) return fail(problems.join(" · "));
    await db.mamoolRegimen.update({ where: { id }, data: { status: "pending", updatedByName: by } });
    await log("submitted");
  } else if (action === "approve") {
    if (r.status !== "pending") return fail("Send it for clinical approval first");
    const problems = readinessProblems(r);
    if (problems.length) return fail(problems.join(" · "));
    const snap = await buildSnapshot(id);
    if (!snap) return fail("Regimen not found");
    await db.$transaction([
      db.mamoolRegimenVersion.upsert({
        where: { regimenId_version: { regimenId: id, version: r.version } },
        update: { snapshot: JSON.stringify(snap), approvedByName: by, reason: comment },
        create: { regimenId: id, version: r.version, snapshot: JSON.stringify(snap), approvedByName: by, reason: comment },
      }),
      db.mamoolRegimen.update({ where: { id }, data: { status: "approved", approvedVersion: r.version, updatedByName: by } }),
    ]);
    await log("approved");
  } else if (action === "reject") {
    if (r.status !== "pending") return fail("Only a regimen waiting for approval can be rejected");
    if (!comment) return fail("Give the reason for rejecting");
    await db.mamoolRegimen.update({ where: { id }, data: { status: "rejected", updatedByName: by } });
    await log("rejected");
  } else if (action === "activate" || action === "deactivate") {
    await db.mamoolRegimen.update({ where: { id }, data: { active: action === "activate", updatedByName: by } });
    await log(action === "activate" ? "activated" : "deactivated");
  } else if (action === "duplicate") {
    const copy = await db.$transaction(async (tx) => {
      const c = await tx.mamoolRegimen.create({
        data: {
          code: await nextRegimenCode(), name: `${r.name} (copy)`.slice(0, 160), description: r.description, clinicalNotes: r.clinicalNotes, createdByName: by, updatedByName: by,
          complaints: { create: r.complaints.map((x) => ({ complaintId: x.complaintId, required: x.required })) },
          medicines: { create: r.medicines.map((m) => ({ tagId: m.tagId, form: m.form, dose: m.dose, timing: m.timing, duration: m.duration, adjuvant: m.adjuvant, instructions: m.instructions, notes: m.notes, sortOrder: m.sortOrder })) },
        },
      });
      await tx.mamoolRegimenReview.create({ data: { regimenId: c.id, version: 1, action: "created", byName: by, comment: `Copied from ${r.code}` } });
      return c;
    });
    await logAdminActivity(session.admin.id, "mamool.duplicated", `Copied ${r.code} to ${copy.code}`).catch(() => {});
    return NextResponse.json({ ok: true, id: copy.id });
  } else {
    return fail("Unknown action");
  }
  await logAdminActivity(session.admin.id, `mamool.${action}`, `Mamool-e-Matab ${r.code} "${r.name}": ${action}${comment ? ` — ${comment}` : ""}`).catch(() => {});
  return NextResponse.json({ ok: true });
}
