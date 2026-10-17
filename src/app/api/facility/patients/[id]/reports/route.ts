import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getClinicActor, patientInScope } from "@/lib/reports-server";
import { REPORT_CATEGORIES, REPORT_FILE_TYPES, REPORT_MAX_FILE_BYTES, REPORT_MAX_FILES, RESULT_FLAGS } from "@/lib/reports";

/** A patient's clinical reports (metadata only — no file bytes). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getClinicActor(req);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!(await patientInScope(id, actor.facilityId))) return NextResponse.json({ error: "Patient not found" }, { status: 404 });

  const reports = await db.patientReport.findMany({
    where: { patientId: id, facilityId: actor.facilityId },
    orderBy: [{ reportDate: "desc" }, { createdAt: "desc" }],
    select: {
      id: true, category: true, title: true, reportDate: true, source: true, resultFlag: true, status: true,
      uploadedByName: true, createdAt: true,
      files: { select: { id: true, mimeType: true }, orderBy: { sortOrder: "asc" } },
    },
  });
  return NextResponse.json({ reports });
}

/** Multipart: category, title, reportDate (yyyy-mm-dd), source, resultFlag, findings, extraction (JSON), files[]. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getClinicActor(req);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!(await patientInScope(id, actor.facilityId))) return NextResponse.json({ error: "Patient not found" }, { status: 404 });

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Invalid upload" }, { status: 400 });
  const field = (k: string) => {
    const v = form.get(k);
    return typeof v === "string" && v.trim() ? v.trim() : null;
  };

  const category = field("category");
  const title = field("title");
  if (!category || !REPORT_CATEGORIES.some((c) => c.value === category)) return NextResponse.json({ error: "Choose a report type" }, { status: 400 });
  if (!title) return NextResponse.json({ error: "Enter the report name" }, { status: 400 });

  const files = form.getAll("files").filter((f): f is File => typeof f !== "string");
  if (!files.length) return NextResponse.json({ error: "Attach at least one photo or PDF of the report" }, { status: 400 });
  if (files.length > REPORT_MAX_FILES) return NextResponse.json({ error: `At most ${REPORT_MAX_FILES} files per report` }, { status: 400 });
  for (const f of files) {
    if (!REPORT_FILE_TYPES.includes(f.type)) return NextResponse.json({ error: `${f.name}: only JPG, PNG, WEBP or PDF files` }, { status: 400 });
    if (f.size > REPORT_MAX_FILE_BYTES) return NextResponse.json({ error: `${f.name} is larger than 8 MB` }, { status: 413 });
  }

  const dateRaw = field("reportDate");
  const reportDate = dateRaw && /^\d{4}-\d{2}-\d{2}$/.test(dateRaw) ? new Date(`${dateRaw}T00:00:00Z`) : null;
  const flag = field("resultFlag");
  let extraction: string | null = null;
  const ex = field("extraction");
  if (ex) { try { extraction = JSON.stringify(JSON.parse(ex)); } catch { /* ignore malformed */ } }

  const report = await db.patientReport.create({
    data: {
      patientId: id, facilityId: actor.facilityId, category, title, reportDate,
      source: field("source"), findings: field("findings"),
      resultFlag: flag && RESULT_FLAGS.some((r) => r.value === flag) ? flag : "unknown",
      extraction,
      uploadedByType: actor.type, uploadedById: actor.id, uploadedByName: actor.name,
      files: {
        create: await Promise.all(files.map(async (f, i) => ({
          fileName: f.name || `page-${i + 1}`, mimeType: f.type, size: f.size,
          data: Buffer.from(await f.arrayBuffer()), sortOrder: i,
        }))),
      },
    },
    select: { id: true },
  });
  return NextResponse.json({ report });
}
