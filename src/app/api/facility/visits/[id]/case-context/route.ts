import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getClinicActor } from "@/lib/reports-server";
import { buildCaseContext } from "@/lib/case-context";

const PREGNANCY = ["pregnant", "breastfeeding", "neither", "unknown"];
const RELIABILITY = ["reliable", "limited", "unreliable"];

/** Stage 5 case context: the sourced case summary, readiness checks and alerts for the visit. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getClinicActor(req);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const ctx = await buildCaseContext(id, actor.facilityId);
  if (!ctx) return NextResponse.json({ error: "Visit not found" }, { status: 404 });
  return NextResponse.json({ context: ctx });
}

/** Body { pregnancyStatus?, historyReliability? } — the two readiness facts recorded at Stage 5. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getClinicActor(req);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const visit = await db.visit.findFirst({ where: { id, facilityId: actor.facilityId }, select: { id: true } });
  if (!visit) return NextResponse.json({ error: "Visit not found" }, { status: 404 });
  const b = await req.json().catch(() => ({}));
  const data: { pregnancyStatus?: string | null; historyReliability?: string | null } = {};
  if ("pregnancyStatus" in b) data.pregnancyStatus = PREGNANCY.includes(b.pregnancyStatus) ? b.pregnancyStatus : null;
  if ("historyReliability" in b) data.historyReliability = RELIABILITY.includes(b.historyReliability) ? b.historyReliability : null;
  await db.visit.update({ where: { id }, data });
  const ctx = await buildCaseContext(id, actor.facilityId);
  return NextResponse.json({ context: ctx });
}
