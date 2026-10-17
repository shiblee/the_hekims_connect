import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { enrichSupplementTags } from "@/lib/supplement-enrichment";

export async function GET(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const [medications, intakes] = await Promise.all([
    db.medicationTag.findMany({ orderBy: [{ kind: "asc" }, { sortOrder: "asc" }] }),
    db.visitIntake.findMany({ select: { medications: true, visit: { select: { patientId: true } } } }),
  ]);

  // Distinct patients on each medication/supplement, keyed by kind+label
  // (case-insensitive) since custom-typed entries may not match label casing.
  const patientsByKey = new Map<string, Set<string>>();
  const patientsWithIntake = new Set<string>();
  for (const intake of intakes) {
    const patientId = intake.visit.patientId;
    patientsWithIntake.add(patientId);
    let list: { label?: string; kind?: string }[] = [];
    try { list = JSON.parse(intake.medications || "[]"); } catch { list = []; }
    for (const entry of list) {
      if (!entry?.label || !entry?.kind) continue;
      const key = `${entry.kind}|${String(entry.label).trim().toLowerCase()}`;
      if (!patientsByKey.has(key)) patientsByKey.set(key, new Set());
      patientsByKey.get(key)!.add(patientId);
    }
  }

  const totalPatients = patientsWithIntake.size;
  const withStats = medications.map((m) => {
    const key = `${m.kind}|${m.label.trim().toLowerCase()}`;
    const patientCount = patientsByKey.get(key)?.size || 0;
    return { ...m, patientCount, patientPercent: totalPatients > 0 ? Math.round((patientCount / totalPatients) * 1000) / 10 : 0 };
  });

  return NextResponse.json({ medications: withStats, totalPatients });
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { kind, label } = await req.json();
  if (kind !== "supplement" && kind !== "medication") {
    return NextResponse.json({ error: "kind must be \"supplement\" or \"medication\"" }, { status: 400 });
  }
  if (!label || !String(label).trim()) {
    return NextResponse.json({ error: "Label is required" }, { status: 400 });
  }

  const existing = await db.medicationTag.findUnique({ where: { kind_label: { kind, label: String(label).trim() } } });
  if (existing) return NextResponse.json({ error: "This entry already exists" }, { status: 409 });

  const maxOrder = await db.medicationTag.aggregate({ where: { kind }, _max: { sortOrder: true } });
  const medication = await db.medicationTag.create({
    data: { kind, label: String(label).trim(), sortOrder: (maxOrder._max.sortOrder ?? -1) + 1 },
  });
  // Build its Unani profile in the background — the response doesn't wait,
  // and the assistant's scheduled backfill retries it if this fails.
  // Build its search-backed reference profile in the background.
  void enrichSupplementTags([medication.id], kind).catch(() => {});
  return NextResponse.json({ medication });
}
