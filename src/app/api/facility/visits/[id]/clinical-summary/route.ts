import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getClinicActor } from "@/lib/reports-server";

const parse = <T,>(s: string | null | undefined, fallback: T): T => {
  try { return s ? JSON.parse(s) : fallback; } catch { return fallback; }
};

/**
 * Everything the clinical team recorded for a visit so far (triage, Stage 2
 * and Stage 3) in one read-only shape — the Stage 4 summary column.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getClinicActor(req);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const visit = await db.visit.findFirst({
    where: { id, facilityId: actor.facilityId },
    select: {
      id: true, patientId: true,
      vitalSigns: { select: { painNotes: true, primaryFocusArea: true, triageRemarks: true } },
      complaintAssessments: { orderBy: { createdAt: "asc" } },
      anatomicalRegionSelection: { select: { regions: true } },
      chronology: true,
      redFlagScreening: { select: { outcome: true, answers: { select: { criterionLabel: true, present: true } } } },
      acuteSymptomAssessment: { select: { symptoms: true } },
      humoralAssessment: { select: { safraPercent: true, damPercent: true, saudaPercent: true, balghamPercent: true, dominant: true, dominantOverride: true, aiClue: true } },
      clinicalRoutingInsight: { select: { priorityLevel: true, triageStream: true, justification: true } },
      residentClinicalNote: { select: { points: true } },
      asbabAssessments: { where: { framework: "asbab" }, select: { status: true, completedAt: true, humoral: true, responses: { select: { pillarKey: true, questionLabel: true, value: true } } } },
    },
  });
  if (!visit) return NextResponse.json({ error: "Visit not found" }, { status: 404 });

  // Question text and severity wording for the doctor's complaint answers.
  const questionIds = [...new Set(visit.complaintAssessments.flatMap((c) => Object.keys(parse<Record<string, unknown>>(c.screeningAnswers, {}))))];
  const [questions, severityLabels, asbabPillars] = await Promise.all([
    db.screeningQuestion.findMany({ where: { id: { in: questionIds } }, select: { id: true, label: true } }),
    db.severityScaleLabel.findMany({ select: { level: true, label: true } }),
    db.asbabPillar.findMany({ where: { framework: "asbab" }, orderBy: { sortOrder: "asc" }, select: { key: true, label: true, english: true } }),
  ]);
  const asbabA = visit.asbabAssessments[0] ?? null;
  const qLabel = new Map<string, string>(questions.map((q) => [q.id, q.label] as const));
  const sevLabel = (n: number | null) => (n == null ? null : severityLabels.find((s) => s.level === n)?.label ?? null);

  const answerText = (v: unknown) => (Array.isArray(v) ? v.join(", ") : v == null ? "" : String(v));

  return NextResponse.json({
    summary: {
      triage: visit.vitalSigns,
      complaints: visit.complaintAssessments.map((c) => ({
        label: c.chiefComplaintLabel,
        durationValue: c.onsetValue, durationUnit: c.onsetUnit,
        severity: c.severityScore, severityLabel: sevLabel(c.severityScore),
        aggravating: parse<string[]>(c.aggravatingFactors, []),
        relieving: parse<string[]>(c.relievingFactors, []),
        answers: Object.entries(parse<Record<string, unknown>>(c.screeningAnswers, {}))
          .map(([qid, v]) => ({ question: qLabel.get(qid) ?? null, answer: answerText(v) }))
          .filter((a) => a.question && a.answer),
        notes: c.clinicalNotes,
      })),
      regions: parse<string[]>(visit.anatomicalRegionSelection?.regions, []),
      chronology: visit.chronology && {
        patterns: parse<string[]>(visit.chronology.onsetPatterns, []),
        durationValue: visit.chronology.durationValue, durationUnit: visit.chronology.durationUnit,
        onsetDate: visit.chronology.onsetDate, source: visit.chronology.durationSource,
        sourceComplaint: visit.chronology.sourceComplaint, note: visit.chronology.note,
      },
      redFlags: visit.redFlagScreening && {
        outcome: visit.redFlagScreening.outcome,
        checked: visit.redFlagScreening.answers.length,
        present: visit.redFlagScreening.answers.filter((a) => a.present).map((a) => a.criterionLabel),
      },
      acuteSymptoms: parse<string[]>(visit.acuteSymptomAssessment?.symptoms, []),
      humoral: visit.humoralAssessment,
      routing: visit.clinicalRoutingInsight,
      residentNotes: parse<string[]>(visit.residentClinicalNote?.points, []),
      // Stage 4 — answers grouped by pillar (from each answer's own snapshot), plus the saved drift.
      asbab: asbabA && {
        status: asbabA.status,
        completedAt: asbabA.completedAt,
        drift: parse<{ percent?: Record<string, number>; dominant?: string | null } | null>(asbabA.humoral, null),
        pillars: asbabPillars
          .map((p) => ({
            key: p.key, label: p.label, english: p.english,
            answers: asbabA!.responses
              .filter((r) => r.pillarKey === p.key)
              .map((r) => {
                const v = parse<unknown>(r.value, "");
                return { question: r.questionLabel, answer: Array.isArray(v) ? v.join(", ") : String(v ?? "") };
              })
              .filter((a) => a.answer),
          }))
          .filter((p) => p.answers.length > 0),
      },
    },
  });
}
