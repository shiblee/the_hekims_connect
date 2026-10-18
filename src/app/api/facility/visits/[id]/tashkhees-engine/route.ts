import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getClinicActor } from "@/lib/reports-server";
import { runTashkheesEngine } from "@/lib/tashkhees-engine";

async function guard(req: NextRequest, id: string) {
  const actor = await getClinicActor(req);
  if (!actor) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const visit = await db.visit.findFirst({ where: { id, facilityId: actor.facilityId }, select: { id: true } });
  if (!visit) return { error: NextResponse.json({ error: "Visit not found" }, { status: 404 }) };
  return { actor };
}

/** Runs the Tashkhees engine on the visit's saved records and stores the suggestion with its provenance. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { actor, error } = await guard(req, id);
  if (error) return error;
  const r = await runTashkheesEngine(id, actor!.facilityId);
  if (!r) return NextResponse.json({ error: "Visit not found" }, { status: 404 });
  const existing = await db.tashkheesSuggestion.findUnique({ where: { visitId: id }, select: { accepted: true, contextHash: true } });
  const data = { suggestion: JSON.stringify(r.suggestion), method: r.method, configVersion: r.configVersion, contextHash: r.contextHash, latencyMs: r.latencyMs };
  await db.tashkheesSuggestion.upsert({ where: { visitId: id }, create: { visitId: id, ...data }, update: data });
  return NextResponse.json({ suggestion: r.suggestion, method: r.method, changed: !!existing && existing.contextHash !== r.contextHash });
}

/** Body { accepted: "mizajAsli" | "suMizaj" | "organs" | "all" } — records which suggestions the doctor took. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { error } = await guard(req, id);
  if (error) return error;
  const b = await req.json().catch(() => ({}));
  const fields = b.accepted === "all" ? ["mizajAsli", "suMizaj", "organs"] : ["mizajAsli", "suMizaj", "organs"].includes(b.accepted) ? [b.accepted] : [];
  if (!fields.length) return NextResponse.json({ error: "Unknown field" }, { status: 400 });
  const row = await db.tashkheesSuggestion.findUnique({ where: { visitId: id } });
  if (!row) return NextResponse.json({ error: "Run the engine first" }, { status: 400 });
  let acc: Record<string, string> = {};
  try { acc = JSON.parse(row.accepted || "{}"); } catch { acc = {}; }
  const at = new Date().toISOString();
  for (const f of fields) acc[f] = at;
  await db.tashkheesSuggestion.update({ where: { visitId: id }, data: { accepted: JSON.stringify(acc) } });
  return NextResponse.json({ ok: true });
}
