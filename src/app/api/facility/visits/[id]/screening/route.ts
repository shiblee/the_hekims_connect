import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/api-auth";
import { formatAge } from "@/lib/age";
import { flagForAnswer, computeOverallFlag, type FlagQuestion } from "@/lib/screening-flags";
import { generateScreeningSummary } from "@/lib/gemini";

async function resolveFacilityId(auth: { id: string; type: "facility" | "patient" | "staff" }): Promise<string | null> {
  if (auth.type === "facility") return auth.id;
  if (auth.type === "staff") {
    const staff = await db.staff.findUnique({ where: { id: auth.id }, select: { facilityId: true } });
    return staff?.facilityId ?? null;
  }
  return null;
}

async function assertOwnedVisit(id: string, facilityId: string) {
  return db.visit.findFirst({
    where: { id, facilityId },
    select: {
      id: true, patientId: true, visitCode: true, visitDate: true,
      patient: { select: { id: true, patientCode: true, name: true, gender: true, dob: true, bloodGroup: true, phone: true, avatarColor: true, mizaj: true } },
    },
  });
}

const ANSWER_SELECT = { id: true, questionId: true, questionLabel: true, value: true, flagTriggered: true };

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth || (auth.type !== "facility" && auth.type !== "staff")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const facilityId = await resolveFacilityId(auth);
  if (!facilityId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const visit = await assertOwnedVisit(id, facilityId);
  if (!visit) return NextResponse.json({ error: "Visit not found" }, { status: 404 });

  const screening = await db.l1Screening.findUnique({
    where: { visitId: id },
    select: {
      id: true, chiefComplaints: true, overallFlag: true, aiSummary: true, createdAt: true, updatedAt: true,
      answers: { select: ANSWER_SELECT },
    },
  });

  return NextResponse.json({
    visit: { id: visit.id, visitCode: visit.visitCode, visitDate: visit.visitDate },
    patient: visit.patient,
    screening,
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth || (auth.type !== "facility" && auth.type !== "staff")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const facilityId = await resolveFacilityId(auth);
  if (!facilityId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const visit = await assertOwnedVisit(id, facilityId);
  if (!visit) return NextResponse.json({ error: "Visit not found" }, { status: 404 });

  const body = await req.json();
  const chiefComplaintIds: string[] = Array.isArray(body.chiefComplaintIds) ? body.chiefComplaintIds : [];
  const submittedAnswers: { questionId: string; value: string | string[] | number }[] = Array.isArray(body.answers) ? body.answers : [];

  if (chiefComplaintIds.length === 0) {
    return NextResponse.json({ error: "Select at least one chief complaint" }, { status: 400 });
  }

  const [complaints, questions] = await Promise.all([
    db.chiefComplaint.findMany({ where: { id: { in: chiefComplaintIds } }, select: { id: true, label: true } }),
    db.screeningQuestion.findMany({
      where: { id: { in: submittedAnswers.map((a) => a.questionId) } },
      select: {
        id: true, label: true, type: true,
        numericOperator: true, numericThreshold: true, numericFlagSeverity: true,
        numericOperator2: true, numericThreshold2: true, numericFlagSeverity2: true,
        options: { select: { label: true, flagSeverity: true } },
      },
    }),
  ]);
  const questionById = new Map(questions.map((q) => [q.id, q]));

  const answerRows = submittedAnswers
    .map((a) => {
      const question = questionById.get(a.questionId);
      if (!question) return null;
      const flag = flagForAnswer(question as FlagQuestion, a.value);
      return {
        questionId: question.id,
        questionLabel: question.label,
        value: JSON.stringify(a.value),
        flagTriggered: flag,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  const overallFlag = computeOverallFlag(answerRows.map((r) => r.flagTriggered));

  // Store complaint labels (not ids) — same reasoning as answer values: the
  // record stays human-readable everywhere it's displayed without a join back
  // to the (possibly later-edited) config.
  const chiefComplaintLabels = complaints.map((c) => c.label);

  const screening = await db.l1Screening.upsert({
    where: { visitId: id },
    update: {
      chiefComplaints: JSON.stringify(chiefComplaintLabels),
      overallFlag,
      recordedById: auth.type === "staff" ? auth.id : null,
      answers: { deleteMany: {}, create: answerRows },
    },
    create: {
      visitId: id,
      chiefComplaints: JSON.stringify(chiefComplaintLabels),
      overallFlag,
      recordedById: auth.type === "staff" ? auth.id : null,
      answers: { create: answerRows },
    },
    select: { id: true, chiefComplaints: true, overallFlag: true, aiSummary: true, createdAt: true, updatedAt: true, answers: { select: ANSWER_SELECT } },
  });

  const formatAnswerValue = (raw: string): string => {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.join(", ") : String(parsed);
  };

  const aiSummary = await generateScreeningSummary(
    { name: visit.patient.name, gender: visit.patient.gender, ageLabel: formatAge(visit.patient.dob), mizaj: visit.patient.mizaj },
    complaints.map((c) => c.label),
    answerRows.map((r) => ({ questionLabel: r.questionLabel, value: formatAnswerValue(r.value), flagTriggered: r.flagTriggered })),
    overallFlag
  );

  const updated = await db.l1Screening.update({
    where: { visitId: id },
    data: { aiSummary },
    select: { id: true, chiefComplaints: true, overallFlag: true, aiSummary: true, createdAt: true, updatedAt: true, answers: { select: ANSWER_SELECT } },
  });

  return NextResponse.json({ screening: updated });
}
