import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { generateVitalsInsight } from "@/lib/gemini";
import { formatAge } from "@/lib/age";

// Unlike the facility-side route, this isn't scoped to one facility — an admin
// can see this patient's vitals history across every facility they've visited.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  const patient = await db.patient.findUnique({ where: { id }, select: { id: true, name: true, gender: true, dob: true } });
  if (!patient) {
    return NextResponse.json({ error: "Patient not found" }, { status: 404 });
  }

  const visits = await db.visit.findMany({
    where: { patientId: id, vitalSigns: { isNot: null } },
    orderBy: { visitDate: "desc" },
    take: 5,
    select: {
      visitDate: true,
      vitalSigns: {
        select: {
          pulse: true, bpSystolic: true, bpDiastolic: true, spo2: true,
          temperatureF: true, respiratoryRate: true, heightCm: true, weightKg: true,
        },
      },
    },
  });

  if (visits.length === 0) {
    return NextResponse.json({ insight: null, reason: "no_data" });
  }

  const insight = await generateVitalsInsight(
    { name: patient.name, gender: patient.gender, ageLabel: formatAge(patient.dob) },
    visits.map((v) => ({ visitDate: v.visitDate, ...v.vitalSigns }))
  );

  if (insight == null) {
    return NextResponse.json({ insight: null, reason: "not_configured" });
  }

  return NextResponse.json({ insight });
}
