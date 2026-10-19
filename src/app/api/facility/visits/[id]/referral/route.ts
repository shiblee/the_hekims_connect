import { NextRequest, NextResponse } from "next/server";
import { logClinicEvent } from "@/lib/clinic-audit";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/api-auth";

async function resolveFacilityId(auth: { id: string; type: "facility" | "patient" | "staff" }): Promise<string | null> {
  if (auth.type === "facility") return auth.id;
  if (auth.type === "staff") {
    const staff = await db.staff.findUnique({ where: { id: auth.id }, select: { facilityId: true } });
    return staff?.facilityId ?? null;
  }
  return null;
}

/** Correct an existing referral's details (reason, destination, urgency, notes). The referral itself stays in place. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth || (auth.type !== "facility" && auth.type !== "staff")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const facilityId = await resolveFacilityId(auth);
  if (!facilityId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const referral = await db.referral.findFirst({ where: { visitId: id, visit: { facilityId } }, select: { id: true } });
  if (!referral) return NextResponse.json({ error: "No referral found for this visit" }, { status: 404 });

  const body = await req.json();
  const reason = String(body.reason ?? "").trim();
  const referredTo = String(body.referredTo ?? "").trim();
  if (!reason) return NextResponse.json({ error: "Referral reason is required" }, { status: 400 });
  if (!referredTo) return NextResponse.json({ error: "Referred-to destination is required" }, { status: 400 });
  if (!["Emergency", "Urgent", "Routine"].includes(body.urgency)) {
    return NextResponse.json({ error: "Urgency must be Emergency, Urgent, or Routine" }, { status: 400 });
  }

  const updated = await db.referral.update({
    where: { id: referral.id },
    data: { reason, referredTo, urgency: body.urgency, notes: body.notes ? String(body.notes).trim() || null : null },
    select: { id: true, reason: true, referredTo: true, urgency: true, notes: true, createdAt: true },
  });
  return NextResponse.json({ referral: updated });
}

/**
 * Withdraw a referral made by mistake. The emergency check goes back to
 * "pending" (not "cleared"), so if warning signs are still marked the page
 * asks for a decision again instead of silently treating the visit as safe.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth || (auth.type !== "facility" && auth.type !== "staff")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const facilityId = await resolveFacilityId(auth);
  if (!facilityId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const referral = await db.referral.findFirst({ where: { visitId: id, visit: { facilityId } }, select: { id: true, screeningId: true } });
  if (!referral) return NextResponse.json({ error: "No referral found for this visit" }, { status: 404 });

  await db.$transaction([
    db.referral.delete({ where: { id: referral.id } }),
    db.redFlagScreening.update({ where: { id: referral.screeningId }, data: { outcome: "pending" } }),
  ]);
  const v = await db.visit.findUnique({ where: { id }, select: { visitCode: true, patient: { select: { name: true } } } });
  await logClinicEvent(req, auth, { action: "visit.referral_withdrawn", summary: `Referral withdrawn for ${v?.visitCode} · ${v?.patient.name}`, entityType: "visit", entityId: id, entityLabel: `${v?.visitCode} · ${v?.patient.name}` });
  return NextResponse.json({ ok: true });
}
