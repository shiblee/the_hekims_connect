import { NextRequest, NextResponse } from "next/server";
import { logClinicEvent } from "@/lib/clinic-audit";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/api-auth";
import { clearClinicalRoutingInsight } from "@/lib/complaint-sync";

async function resolveFacilityId(auth: { id: string; type: "facility" | "patient" | "staff" }): Promise<string | null> {
  if (auth.type === "facility") return auth.id;
  if (auth.type === "staff") {
    const staff = await db.staff.findUnique({ where: { id: auth.id }, select: { facilityId: true } });
    return staff?.facilityId ?? null;
  }
  return null;
}

async function assertOwnedVisit(id: string, facilityId: string) {
  return db.visit.findFirst({ where: { id, facilityId }, select: { id: true } });
}

const SCREENING_SELECT = {
  id: true, outcome: true, createdAt: true, updatedAt: true,
  answers: { select: { id: true, criterionId: true, criterionLabel: true, present: true } },
  referral: { select: { id: true, reason: true, referredTo: true, urgency: true, notes: true, createdAt: true } },
  amaDecline: { select: { id: true, reason: true, patientReason: true, declineReason: true, createdAt: true } },
};

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

  const screening = await db.redFlagScreening.findUnique({ where: { visitId: id }, select: SCREENING_SELECT });
  return NextResponse.json({ screening });
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

  // A referral (and the screening it closes out) is a permanent clinical
  // record once made — don't let a later call silently overwrite it.
  const existing = await db.redFlagScreening.findUnique({ where: { visitId: id }, select: { outcome: true } });
  if (existing?.outcome === "referred") {
    return NextResponse.json({ error: "This visit has already been referred and the case is closed." }, { status: 409 });
  }

  const body = await req.json();
  const answersIn: { criterionId: string; present: boolean }[] = Array.isArray(body.answers) ? body.answers : [];
  const outcome = body.outcome === "referred" ? "referred" : body.outcome === "continued_ama" ? "continued_ama" : "cleared";

  const criteria = await db.redFlagCriterion.findMany({
    where: { id: { in: answersIn.map((a) => a.criterionId) } },
    select: { id: true, label: true },
  });
  const criterionById = new Map(criteria.map((c) => [c.id, c]));

  const answerRows: { criterionId: string | null; criterionLabel: string; present: boolean }[] = answersIn
    .map((a) => {
      const criterion = criterionById.get(a.criterionId);
      if (!criterion) return null;
      return { criterionId: criterion.id, criterionLabel: criterion.label, present: !!a.present };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);
  // "Other" warning signs typed in by staff — not in the admin list, so no
  // criterion link; saved by label as present findings.
  const knownLabels = new Set(answerRows.map((r) => r.criterionLabel.toLowerCase()));
  const customLabels: string[] = Array.isArray(body.custom) ? body.custom : [];
  for (const raw of customLabels) {
    const label = String(raw ?? "").trim().slice(0, 200);
    if (!label || knownLabels.has(label.toLowerCase())) continue;
    knownLabels.add(label.toLowerCase());
    answerRows.push({ criterionId: null, criterionLabel: label, present: true });
  }

  // Save Draft — store the marked signs without making the referral decision.
  // A cleared screening stays cleared only while nothing is marked; an AMA
  // decision is kept; otherwise it waits as "pending" for Proceed / Refer.
  if (body.draft) {
    const hasPresent = answerRows.some((r) => r.present);
    const draftOutcome = existing?.outcome === "continued_ama" ? "continued_ama" : existing?.outcome === "cleared" && !hasPresent ? "cleared" : "pending";
    const screening = await db.redFlagScreening.upsert({
      where: { visitId: id },
      update: { outcome: draftOutcome, recordedById: auth.staffId ?? null, answers: { deleteMany: {}, create: answerRows } },
      create: { visitId: id, outcome: draftOutcome, recordedById: auth.staffId ?? null, answers: { create: answerRows } },
      select: SCREENING_SELECT,
    });
    return NextResponse.json({ screening });
  }

  if (outcome === "referred") {
    const referral = body.referral || {};
    if (!referral.reason || !String(referral.reason).trim()) {
      return NextResponse.json({ error: "Referral reason is required" }, { status: 400 });
    }
    if (!referral.referredTo || !String(referral.referredTo).trim()) {
      return NextResponse.json({ error: "Referred-to destination is required" }, { status: 400 });
    }
    if (!["Emergency", "Urgent", "Routine"].includes(referral.urgency)) {
      return NextResponse.json({ error: "Urgency must be Emergency, Urgent, or Routine" }, { status: 400 });
    }

    const screening = await db.redFlagScreening.upsert({
      where: { visitId: id },
      update: { outcome: "referred", recordedById: auth.staffId ?? null, answers: { deleteMany: {}, create: answerRows } },
      create: { visitId: id, outcome: "referred", recordedById: auth.staffId ?? null, answers: { create: answerRows } },
      select: { id: true },
    });

    await db.referral.create({
      data: {
        visitId: id,
        screeningId: screening.id,
        reason: String(referral.reason).trim(),
        referredTo: String(referral.referredTo).trim(),
        urgency: referral.urgency,
        notes: referral.notes ? String(referral.notes).trim() : null,
        referredById: auth.staffId ?? null,
      },
    });
    await db.visit.update({ where: { id }, data: { status: "referred" } });
    const v = await db.visit.findUnique({ where: { id }, select: { visitCode: true, patient: { select: { name: true } } } });
    await logClinicEvent(req, auth, { action: "visit.referred", summary: `${v?.visitCode} · ${v?.patient.name} referred to ${String(referral.referredTo).trim()} (${referral.urgency})`, entityType: "visit", entityId: id, entityLabel: `${v?.visitCode} · ${v?.patient.name}` });
    await clearClinicalRoutingInsight(id);

    const full = await db.redFlagScreening.findUnique({ where: { visitId: id }, select: SCREENING_SELECT });
    return NextResponse.json({ screening: full });
  }

  if (outcome === "continued_ama") {
    const ama = body.amaDecline || {};
    if (!ama.reason || !String(ama.reason).trim()) {
      return NextResponse.json({ error: "A reason referral was recommended is required" }, { status: 400 });
    }
    if (!ama.acknowledged) {
      return NextResponse.json({ error: "Staff must confirm the patient was informed of the risks" }, { status: 400 });
    }

    const declineReason = ama.declineReason ? String(ama.declineReason).trim().slice(0, 200) || null : null;

    const screening = await db.redFlagScreening.upsert({
      where: { visitId: id },
      update: { outcome: "continued_ama", recordedById: auth.staffId ?? null, answers: { deleteMany: {}, create: answerRows } },
      create: { visitId: id, outcome: "continued_ama", recordedById: auth.staffId ?? null, answers: { create: answerRows } },
      select: { id: true },
    });

    await db.amaDecline.upsert({
      where: { screeningId: screening.id },
      update: {
        reason: String(ama.reason).trim(),
        patientReason: ama.patientReason ? String(ama.patientReason).trim() : null,
        declineReason: declineReason,
        recordedById: auth.staffId ?? null,
      },
      create: {
        visitId: id,
        screeningId: screening.id,
        reason: String(ama.reason).trim(),
        patientReason: ama.patientReason ? String(ama.patientReason).trim() : null,
        declineReason: declineReason,
        recordedById: auth.staffId ?? null,
      },
    });
    await clearClinicalRoutingInsight(id);

    const full = await db.redFlagScreening.findUnique({ where: { visitId: id }, select: SCREENING_SELECT });
    return NextResponse.json({ screening: full });
  }

  // Moving away from a prior AMA decline back to "cleared" (all red flags
  // re-assessed as negative) — drop the stale AMA record so it doesn't
  // linger alongside a now-clean screening.
  await db.amaDecline.deleteMany({ where: { visitId: id } });

  const screening = await db.redFlagScreening.upsert({
    where: { visitId: id },
    update: { outcome: "cleared", recordedById: auth.staffId ?? null, answers: { deleteMany: {}, create: answerRows } },
    create: { visitId: id, outcome: "cleared", recordedById: auth.staffId ?? null, answers: { create: answerRows } },
    select: SCREENING_SELECT,
  });
  await clearClinicalRoutingInsight(id);

  return NextResponse.json({ screening });
}
