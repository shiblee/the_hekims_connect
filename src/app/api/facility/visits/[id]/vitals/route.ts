import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/api-auth";

const VITALS_SELECT = {
  pulse: true, bpSystolic: true, bpDiastolic: true, spo2: true, spo2Context: true,
  oxygenLitres: true, temperatureF: true, temperatureC: true, respiratoryRate: true,
  consciousnessLevel: true, mood: true, heightCm: true, weightKg: true, updatedAt: true,
};

async function assertOwnedVisit(id: string, facilityId: string) {
  return db.visit.findFirst({
    where: { id, facilityId },
    select: {
      id: true, visitCode: true, visitDate: true, patientId: true,
      patient: {
        select: {
          id: true, patientCode: true, name: true, gender: true, dob: true,
          dobApprox: true, bloodGroup: true, phone: true, avatarColor: true,
        },
      },
    },
  });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth || auth.type !== "facility") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const visit = await assertOwnedVisit(id, auth.id);
  if (!visit) {
    return NextResponse.json({ error: "Visit not found" }, { status: 404 });
  }

  const [vitals, previousVisit] = await Promise.all([
    db.vitalSigns.findUnique({ where: { visitId: id }, select: VITALS_SELECT }),
    db.visit.findFirst({
      where: { patientId: visit.patientId, id: { not: id }, vitalSigns: { isNot: null } },
      orderBy: { visitDate: "desc" },
      select: { visitDate: true, visitCode: true, vitalSigns: { select: VITALS_SELECT } },
    }),
  ]);

  return NextResponse.json({
    visit: { id: visit.id, visitCode: visit.visitCode, visitDate: visit.visitDate, patient: visit.patient },
    vitals,
    previous: previousVisit ? { visitCode: previousVisit.visitCode, visitDate: previousVisit.visitDate, ...previousVisit.vitalSigns } : null,
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth || auth.type !== "facility") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const visit = await assertOwnedVisit(id, auth.id);
  if (!visit) {
    return NextResponse.json({ error: "Visit not found" }, { status: 404 });
  }

  const body = await req.json();
  const toInt = (v: unknown) => (v === "" || v === null || v === undefined ? null : parseInt(String(v), 10));
  const toFloat = (v: unknown) => (v === "" || v === null || v === undefined ? null : parseFloat(String(v)));

  const data = {
    pulse: toInt(body.pulse),
    bpSystolic: toInt(body.bpSystolic),
    bpDiastolic: toInt(body.bpDiastolic),
    spo2: toInt(body.spo2),
    spo2Context: body.spo2Context || null,
    oxygenLitres: toFloat(body.oxygenLitres),
    temperatureF: toFloat(body.temperatureF),
    temperatureC: toFloat(body.temperatureC),
    respiratoryRate: toInt(body.respiratoryRate),
    consciousnessLevel: body.consciousnessLevel || null,
    mood: body.mood || null,
    heightCm: toFloat(body.heightCm),
    weightKg: toFloat(body.weightKg),
  };

  const vitals = await db.vitalSigns.upsert({
    where: { visitId: id },
    update: data,
    create: { visitId: id, ...data },
    select: VITALS_SELECT,
  });

  return NextResponse.json({ vitals });
}
