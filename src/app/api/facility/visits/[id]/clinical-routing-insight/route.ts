import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/api-auth";
import { formatAge } from "@/lib/age";
import { generateClinicalRouting, geminiQuotaRecentlyHit } from "@/lib/gemini";

async function resolveFacilityId(auth: { id: string; type: "facility" | "patient" | "staff" }): Promise<string | null> {
  if (auth.type === "facility") return auth.id;
  if (auth.type === "staff") {
    const staff = await db.staff.findUnique({ where: { id: auth.id }, select: { facilityId: true } });
    return staff?.facilityId ?? null;
  }
  return null;
}

const SELECT = { priorityLevel: true, triageStream: true, justification: true, generatedAt: true };

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth || (auth.type !== "facility" && auth.type !== "staff")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const facilityId = await resolveFacilityId(auth);
  if (!facilityId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const visit = await db.visit.findFirst({ where: { id, facilityId }, select: { id: true } });
  if (!visit) return NextResponse.json({ error: "Visit not found" }, { status: 404 });

  const routing = await db.clinicalRoutingInsight.findUnique({ where: { visitId: id }, select: SELECT });
  return NextResponse.json({ routing });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth || (auth.type !== "facility" && auth.type !== "staff")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const facilityId = await resolveFacilityId(auth);
  if (!facilityId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const visit = await db.visit.findFirst({
    where: { id, facilityId },
    select: {
      patient: { select: { name: true, gender: true, dob: true } },
      vitalSigns: { select: { pulse: true, bpSystolic: true, bpDiastolic: true, spo2: true, temperatureF: true } },
      redFlagScreening: {
        select: { outcome: true, answers: { select: { criterionLabel: true, present: true } } },
      },
      complaintAssessments: { select: { chiefComplaintLabel: true, severityScore: true, onsetValue: true, onsetUnit: true } },
      acuteSymptomAssessment: { select: { symptoms: true } },
    },
  });
  if (!visit) return NextResponse.json({ error: "Visit not found" }, { status: 404 });

  let acuteSymptoms: string[] = [];
  try { acuteSymptoms = JSON.parse(visit.acuteSymptomAssessment?.symptoms || "[]"); } catch { acuteSymptoms = []; }

  const routing = await generateClinicalRouting(
    { name: visit.patient.name, gender: visit.patient.gender, ageLabel: formatAge(visit.patient.dob) },
    {
      vitals: visit.vitalSigns,
      redFlagOutcome: (visit.redFlagScreening?.outcome as any) || null,
      redFlagPositiveFindings: (visit.redFlagScreening?.answers || []).filter((a) => a.present).map((a) => a.criterionLabel),
      chiefComplaints: visit.complaintAssessments.map((c) => ({
        label: c.chiefComplaintLabel, severityScore: c.severityScore, onsetValue: c.onsetValue, onsetUnit: c.onsetUnit,
      })),
      acuteSymptoms,
    }
  );

  if (!routing) return NextResponse.json({ routing: null, unavailable: true, reason: geminiQuotaRecentlyHit() ? "quota" : "unavailable" });

  const saved = await db.clinicalRoutingInsight.upsert({
    where: { visitId: id },
    update: { priorityLevel: routing.priorityLevel, triageStream: routing.triageStream, justification: routing.justification },
    create: { visitId: id, priorityLevel: routing.priorityLevel, triageStream: routing.triageStream, justification: routing.justification },
    select: SELECT,
  });
  return NextResponse.json({ routing: saved });
}
