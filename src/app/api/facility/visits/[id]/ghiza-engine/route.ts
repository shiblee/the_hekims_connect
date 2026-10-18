import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getClinicActor } from "@/lib/reports-server";
import { runGhizaEngine } from "@/lib/ghiza-engine";

async function guard(req: NextRequest, id: string) {
  const actor = await getClinicActor(req);
  if (!actor) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const visit = await db.visit.findFirst({ where: { id, facilityId: actor.facilityId }, select: { id: true } });
  if (!visit) return { error: NextResponse.json({ error: "Visit not found" }, { status: 404 }) };
  return { actor };
}

/** Runs the diet engine on the visit's saved diagnosis, history and findings; stores the result with its provenance. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { actor, error } = await guard(req, id);
  if (error) return error;
  const r = await runGhizaEngine(id, actor!.facilityId);
  if (!r) return NextResponse.json({ error: "Visit not found" }, { status: 404 });
  const data = { suggestion: JSON.stringify(r.plan), method: r.method, configVersion: r.configVersion, contextHash: r.contextHash, latencyMs: r.latencyMs };
  await db.ghizaSuggestion.upsert({ where: { visitId: id }, create: { visitId: id, ...data }, update: data });
  return NextResponse.json({ plan: r.plan, method: r.method });
}

/** Body { accepted: string[] } — the foods the doctor took (recommended or Parhez). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { error } = await guard(req, id);
  if (error) return error;
  const b = await req.json().catch(() => ({}));
  const labels: string[] = Array.isArray(b.accepted) ? b.accepted.filter((x: unknown): x is string => typeof x === "string").slice(0, 30) : [];
  const row = await db.ghizaSuggestion.findUnique({ where: { visitId: id } });
  if (!row || !labels.length) return NextResponse.json({ error: "Nothing to record" }, { status: 400 });
  let acc: { label: string; at: string }[] = [];
  try { acc = JSON.parse(row.accepted || "[]"); } catch { acc = []; }
  const at = new Date().toISOString();
  for (const l of labels) if (!acc.some((x) => x.label === l)) acc.push({ label: l, at });
  await db.ghizaSuggestion.update({ where: { visitId: id }, data: { accepted: JSON.stringify(acc) } });
  return NextResponse.json({ ok: true });
}
