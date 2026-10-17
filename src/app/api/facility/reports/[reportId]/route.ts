import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getClinicActor } from "@/lib/reports-server";
import { REPORT_CATEGORIES, RESULT_FLAGS } from "@/lib/reports";

async function load(req: NextRequest, reportId: string) {
  const actor = await getClinicActor(req);
  if (!actor) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const report = await db.patientReport.findFirst({ where: { id: reportId, facilityId: actor.facilityId }, select: { id: true } });
  if (!report) return { error: NextResponse.json({ error: "Report not found" }, { status: 404 }) };
  return { actor };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ reportId: string }> }) {
  const { reportId } = await params;
  const { error } = await load(req, reportId);
  if (error) return error;
  const report = await db.patientReport.findUnique({
    where: { id: reportId },
    select: {
      id: true, patientId: true, category: true, title: true, reportDate: true, source: true, resultFlag: true, findings: true,
      extraction: true, status: true, uploadedByName: true, reviewedByName: true, reviewedAt: true, reviewNote: true, createdAt: true,
      files: { select: { id: true, fileName: true, mimeType: true, size: true }, orderBy: { sortOrder: "asc" } },
    },
  });
  return NextResponse.json({ report });
}

/** Edit fields, or review: { status: "reviewed" | "pending_review", reviewNote }. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ reportId: string }> }) {
  const { reportId } = await params;
  const { actor, error } = await load(req, reportId);
  if (error) return error;
  const b = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  if (b.category !== undefined && REPORT_CATEGORIES.some((c) => c.value === b.category)) data.category = b.category;
  if (b.title !== undefined && str(b.title)) data.title = str(b.title);
  if (b.source !== undefined) data.source = str(b.source);
  if (b.findings !== undefined) data.findings = str(b.findings);
  if (b.resultFlag !== undefined && RESULT_FLAGS.some((r) => r.value === b.resultFlag)) data.resultFlag = b.resultFlag;
  if (b.reportDate !== undefined) data.reportDate = typeof b.reportDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.reportDate) ? new Date(`${b.reportDate}T00:00:00Z`) : null;
  if (b.status === "reviewed") {
    Object.assign(data, { status: "reviewed", reviewedByName: actor!.name, reviewedAt: new Date(), reviewNote: str(b.reviewNote) });
  } else if (b.status === "pending_review") {
    Object.assign(data, { status: "pending_review", reviewedByName: null, reviewedAt: null, reviewNote: null });
  }
  await db.patientReport.update({ where: { id: reportId }, data });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ reportId: string }> }) {
  const { reportId } = await params;
  const { error } = await load(req, reportId);
  if (error) return error;
  await db.patientReport.delete({ where: { id: reportId } });
  return NextResponse.json({ ok: true });
}
