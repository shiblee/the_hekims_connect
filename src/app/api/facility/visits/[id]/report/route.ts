import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/api-auth";
import { getReportBranding } from "@/lib/report-branding";
import { getVitalsRangeConfig } from "@/lib/vitals-ranges-server";

const parse = <T,>(raw: string | null | undefined, fallback: T): T => { try { return raw ? (JSON.parse(raw) as T) : fallback; } catch { return fallback; } };

async function resolveFacilityId(auth: { id: string; type: "facility" | "patient" | "staff" }): Promise<string | null> {
  if (auth.type === "facility") return auth.id;
  if (auth.type === "staff") {
    const staff = await db.staff.findUnique({ where: { id: auth.id }, select: { facilityId: true } });
    return staff?.facilityId ?? null;
  }
  return null;
}

/**
 * Everything recorded for one visit, assembled for the printable assessment
 * report. Read-only: generating a report never changes the visit. All data is
 * scoped to this visit (and this patient), and to the requesting clinic.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
      id: true, visitCode: true, visitDate: true, status: true, reasonForVisit: true, createdAt: true, patientId: true,
      doctor: { select: { name: true, staffCode: true, designation: true, qualification: true, specialization: true, registrationNumber: true } },
      registeredBy: { select: { name: true, designation: true } },
      vitalSigns: true,
      intake: { select: { chiefComplaints: true, narrative: true, onsetTimeline: true, allergies: true, medications: true, mobility: true, updatedAt: true } },
      l1Screening: { select: { chiefComplaints: true, aiSummary: true, updatedAt: true } },
      complaintAssessments: { orderBy: { sortOrder: "asc" }, select: { chiefComplaintLabel: true, onsetValue: true, onsetUnit: true, onsetPattern: true, severityScore: true, character: true, aggravatingFactors: true, relievingFactors: true, clinicalNotes: true, updatedAt: true } },
      redFlagScreening: { select: { outcome: true, updatedAt: true, answers: { select: { criterionId: true, criterionLabel: true, present: true } } } },
      referral: { select: { reason: true, referredTo: true, urgency: true, notes: true, createdAt: true, referredBy: { select: { name: true } } } },
      amaDecline: { select: { reason: true, patientReason: true, createdAt: true } },
      acuteSymptomAssessment: { select: { symptoms: true, updatedAt: true } },
      humoralAssessment: { select: { safraPercent: true, damPercent: true, saudaPercent: true, balghamPercent: true, dominant: true, dominantOverride: true, aiClue: true, aiClueGeneratedAt: true, computedAt: true } },
      clinicalRoutingInsight: { select: { priorityLevel: true, triageStream: true, justification: true, generatedAt: true, updatedAt: true } },
      vitalsInsightRecord: { select: { insight: true, generatedAt: true, updatedAt: true } },
      residentClinicalNote: { select: { points: true, updatedAt: true } },
      anatomicalRegionSelection: { select: { regions: true } },
      chronology: { select: { onsetPatterns: true, durationValue: true, durationUnit: true, onsetDate: true, note: true, durationSource: true, sourceComplaint: true, updatedAt: true } },
      asbabAssessments: { where: { framework: "asbab" }, select: { status: true, completedAt: true } },
      tashkheesDossier: { select: { status: true, mizajAsli: true, suMizajType: true, suMizajQuality: true, suMizajGrade: true, diagnosisNote: true, finalizedAt: true, finalizedByName: true } },
    },
  });
  if (!visit) return NextResponse.json({ error: "Visit not found" }, { status: 404 });

  const [patient, facility, priorVisits, reports, criteriaCount, branding, ranges, severityLabels, mizajAssessment] = await Promise.all([
    db.patient.findUnique({
      where: { id: visit.patientId },
      select: {
        patientCode: true, name: true, titlePrefix: true, dob: true, dobApprox: true, gender: true, maritalStatus: true, bloodGroup: true,
        phone: true, address: true, city: true, state: true, occupation: true,
        emergencyContact: true, emergencyContactName: true, emergencyRelationship: true,
        chronicConditions: true, medicalHistory: true, surgicalHistory: true, familyHistory: true, lifestyle: true,
        allergies: true, currentMedications: true, mizaj: true, createdAt: true,
      },
    }),
    db.facility.findUnique({
      where: { id: facilityId },
      select: { facilityName: true, registeredFacilityName: true, facilityType: true, hfrNumber: true, phone: true, email: true, addressLine1: true, addressLine2: true, locality: true, city: true, state: true, pincode: true },
    }),
    // Earlier visits — only for height/weight carried forward, and a count.
    db.visit.findMany({
      where: { patientId: visit.patientId, facilityId, visitDate: { lt: visit.visitDate } },
      orderBy: { visitDate: "desc" },
      select: { visitCode: true, visitDate: true, vitalSigns: { select: { heightCm: true, weightKg: true } } },
    }),
    db.patientReport.findMany({
      where: { patientId: visit.patientId, facilityId },
      orderBy: { createdAt: "desc" },
      select: { title: true, category: true, reportDate: true, source: true, resultFlag: true, findings: true, status: true, reviewedByName: true, createdAt: true },
    }),
    db.redFlagCriterion.count({ where: { active: true } }),
    getReportBranding(),
    getVitalsRangeConfig(),
    db.severityScaleLabel.findMany({ select: { level: true, label: true } }),
    // The patient's most recent Mizaj assessment at this clinic (Stage 3 history).
    db.mizajAssessment.findFirst({
      where: { patientId: visit.patientId, facilityId },
      orderBy: { createdAt: "desc" },
      select: { result: true, pulse: true, notes: true, dam: true, saffra: true, balgham: true, sauda: true, createdAt: true },
    }),
  ]);
  if (!patient) return NextResponse.json({ error: "Patient not found" }, { status: 404 });

  const priorMeasure = priorVisits.find((v) => v.vitalSigns?.heightCm != null || v.vitalSigns?.weightKg != null);
  const generatedAt = new Date();
  const stamp = generatedAt.toISOString().replace(/[-:T]/g, "").slice(0, 12);

  return NextResponse.json({
    report: {
      id: `RPT-${visit.visitCode}-${stamp}`,
      generatedAt: generatedAt.toISOString(),
      generatedBy: auth.type === "staff" ? (await db.staff.findUnique({ where: { id: auth.id }, select: { name: true } }))?.name ?? null : facility?.facilityName ?? null,
    },
    branding,
    normalRanges: ranges.normalRanges,
    severityLabels,
    facility,
    patient: { ...patient, previousVisitCount: priorVisits.length },
    visit: {
      visitCode: visit.visitCode, visitDate: visit.visitDate, status: visit.status, reasonForVisit: visit.reasonForVisit,
      doctor: visit.doctor, registeredBy: visit.registeredBy,
    },
    vitals: visit.vitalSigns,
    carriedMeasure: priorMeasure ? { visitCode: priorMeasure.visitCode, visitDate: priorMeasure.visitDate, heightCm: priorMeasure.vitalSigns?.heightCm ?? null, weightKg: priorMeasure.vitalSigns?.weightKg ?? null } : null,
    intake: visit.intake && {
      chiefComplaints: parse<string[]>(visit.intake.chiefComplaints, []),
      narrative: visit.intake.narrative, onsetTimeline: visit.intake.onsetTimeline,
      allergies: parse<string[]>(visit.intake.allergies, []),
      medications: parse<{ label: string; kind: string }[]>(visit.intake.medications, []),
      mobility: visit.intake.mobility, updatedAt: visit.intake.updatedAt,
    },
    l1Screening: visit.l1Screening && { complaints: parse<string[]>(visit.l1Screening.chiefComplaints, []), insight: visit.l1Screening.aiSummary, updatedAt: visit.l1Screening.updatedAt },
    complaints: visit.complaintAssessments.map((c) => ({
      ...c,
      aggravatingFactors: parse<string[]>(c.aggravatingFactors, []),
      relievingFactors: parse<string[]>(c.relievingFactors, []),
    })),
    warningSigns: visit.redFlagScreening && {
      outcome: visit.redFlagScreening.outcome, updatedAt: visit.redFlagScreening.updatedAt, criteriaCount,
      present: visit.redFlagScreening.answers.filter((a) => a.present).map((a) => ({ label: a.criterionLabel, custom: !a.criterionId })),
      reviewed: visit.redFlagScreening.answers.filter((a) => a.criterionId).length,
    },
    referral: visit.referral,
    amaDecline: visit.amaDecline,
    otherSymptoms: visit.acuteSymptomAssessment ? { symptoms: parse<string[]>(visit.acuteSymptomAssessment.symptoms, []), updatedAt: visit.acuteSymptomAssessment.updatedAt } : null,
    humoral: visit.humoralAssessment,
    routing: visit.clinicalRoutingInsight,
    vitalsInsight: visit.vitalsInsightRecord,
    residentNotes: visit.residentClinicalNote ? { points: parse<string[]>(visit.residentClinicalNote.points, []), updatedAt: visit.residentClinicalNote.updatedAt } : null,
    later: {
      regions: parse<string[]>(visit.anatomicalRegionSelection?.regions, []),
      chronology: visit.chronology && { ...visit.chronology, onsetPatterns: parse<string[]>(visit.chronology.onsetPatterns, []) },
      asbab: visit.asbabAssessments[0] ?? null,
      dossier: visit.tashkheesDossier,
      mizajAssessment,
    },
    reports,
  });
}
