import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/api-auth";
import { generateVitalsInsight } from "@/lib/gemini";
import { formatAge } from "@/lib/age";

// Same ownership check used by every other facility-scoped patient route —
// a facility can only see a patient it has an actual Visit/Appointment with.
async function assertInScope(patientId: string, facilityId: string) {
  return db.patient.findFirst({
    where: {
      id: patientId,
      OR: [{ visits: { some: { facilityId } } }, { appointments: { some: { facilityId } } }],
    },
    select: { id: true, name: true, gender: true, dob: true },
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth || auth.type !== "facility") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const patient = await assertInScope(id, auth.id);
  if (!patient) {
    return NextResponse.json({ error: "Patient not found" }, { status: 404 });
  }

  const visits = await db.visit.findMany({
    where: { patientId: id, facilityId: auth.id, vitalSigns: { isNot: null } },
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
