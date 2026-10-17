import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const [allergies, intakes] = await Promise.all([
    db.allergyTag.findMany({ orderBy: { sortOrder: "asc" } }),
    db.visitIntake.findMany({ select: { allergies: true, visit: { select: { patientId: true } } } }),
  ]);

  // Distinct patients affected per allergy label, matched case-insensitively
  // since a front-desk-typed custom entry may not match the admin label's casing.
  const patientsByLabel = new Map<string, Set<string>>();
  const patientsWithIntake = new Set<string>();
  for (const intake of intakes) {
    const patientId = intake.visit.patientId;
    patientsWithIntake.add(patientId);
    let list: string[] = [];
    try { list = JSON.parse(intake.allergies || "[]"); } catch { list = []; }
    for (const label of list) {
      const key = String(label).trim().toLowerCase();
      if (!key) continue;
      if (!patientsByLabel.has(key)) patientsByLabel.set(key, new Set());
      patientsByLabel.get(key)!.add(patientId);
    }
  }

  const totalPatients = patientsWithIntake.size;
  const withStats = allergies.map((a) => {
    const patientCount = patientsByLabel.get(a.label.trim().toLowerCase())?.size || 0;
    return { ...a, patientCount, patientPercent: totalPatients > 0 ? Math.round((patientCount / totalPatients) * 1000) / 10 : 0 };
  });

  return NextResponse.json({ allergies: withStats, totalPatients });
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { label } = await req.json();
  if (!label || !String(label).trim()) {
    return NextResponse.json({ error: "Label is required" }, { status: 400 });
  }

  const existing = await db.allergyTag.findUnique({ where: { label: String(label).trim() } });
  if (existing) return NextResponse.json({ error: "This allergy already exists" }, { status: 409 });

  const maxOrder = await db.allergyTag.aggregate({ _max: { sortOrder: true } });
  const allergy = await db.allergyTag.create({
    data: { label: String(label).trim(), sortOrder: (maxOrder._max.sortOrder ?? -1) + 1 },
  });
  return NextResponse.json({ allergy });
}
