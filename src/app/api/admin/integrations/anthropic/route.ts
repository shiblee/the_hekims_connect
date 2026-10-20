import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, logAdminActivity } from "@/lib/admin-auth";
import { getClientIp } from "@/lib/request-info";
import { decryptSecret, encryptSecret } from "@/lib/secret-crypto";
import { getReasoningPilot, testClaudeKey } from "@/lib/claude";

/**
 * Admin → Settings → AI services: the Anthropic (Claude) key for the Stage 5 clinical reasoning
 * assistant (stored encrypted, never sent back in full) and its on/off switch. Off by default.
 */
async function summary() {
  const row = await db.integrationConfig.findUnique({ where: { provider: "anthropic" } });
  const key = row?.keyEnc ? decryptSecret(row.keyEnc) : null;
  const [pilot, clinics] = await Promise.all([getReasoningPilot(), db.facility.findMany({ where: { active: true }, select: { id: true, facilityName: true }, orderBy: { facilityName: "asc" } })]);
  return { configured: !!key, active: !!row?.active && !!key, keyHint: key ? `•••• ${key.slice(-4)}` : null, updatedAt: row?.updatedAt ?? null, pilot, clinics: clinics.map((c) => ({ id: c.id, name: c.facilityName })) };
}

export async function GET(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  return NextResponse.json(await summary());
}

/** Body { active?: boolean, apiKey?: string, removeKey?: true }. */
export async function PUT(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const data: { active?: boolean; keyEnc?: string | null } = {};
  const changes: string[] = [];
  // Pilot: who may use it.
  if (body.pilot && typeof body.pilot === "object") {
    const pilot = { mode: body.pilot.mode === "all" ? "all" : "selected", clinics: Array.isArray(body.pilot.clinics) ? body.pilot.clinics.filter((x: unknown) => typeof x === "string").slice(0, 200) : [] };
    await db.portalSetting.upsert({ where: { category_key: { category: "reasoning", key: "pilot" } }, create: { category: "reasoning", key: "pilot", value: JSON.stringify(pilot) }, update: { value: JSON.stringify(pilot) } });
    await logAdminActivity(session.admin.id, "ai_service_updated", `Clinical reasoning available to: ${pilot.mode === "all" ? "all clinics" : `${pilot.clinics.length} selected clinic(s)`}`, getClientIp(req));
    if (body.active === undefined && body.apiKey === undefined && body.removeKey === undefined) return NextResponse.json(await summary());
  }
  if (body.removeKey === true) { data.keyEnc = null; data.active = false; changes.push("key removed, switched off"); }
  else if (typeof body.apiKey === "string") {
    const key = body.apiKey.trim();
    if (!/^sk-ant-/.test(key) || key.length < 30 || /\s/.test(key)) return NextResponse.json({ error: "That doesn't look like an Anthropic API key — it starts with sk-ant-. Copy it again from the Anthropic Console." }, { status: 400 });
    data.keyEnc = encryptSecret(key);
    changes.push(`key replaced (ends ${key.slice(-4)})`);
  }
  if (typeof body.active === "boolean" && body.removeKey !== true) { data.active = body.active; changes.push(`switched ${body.active ? "on" : "off"}`); }
  if (!changes.length) return NextResponse.json({ error: "Nothing to change" }, { status: 400 });
  const existing = await db.integrationConfig.findUnique({ where: { provider: "anthropic" } });
  if (data.active && !(data.keyEnc ?? existing?.keyEnc)) return NextResponse.json({ error: "Add a key before switching the AI service on." }, { status: 400 });
  await db.integrationConfig.upsert({
    where: { provider: "anthropic" },
    create: { provider: "anthropic", keyEnc: data.keyEnc ?? null, active: data.active ?? false },
    update: data,
  });
  await logAdminActivity(session.admin.id, "ai_service_updated", `AI service (Claude): ${changes.join("; ")}`, getClientIp(req));
  return NextResponse.json(await summary());
}

/** Body { apiKey?: string } — tests the given key, or the saved one. Works even while switched off. */
export async function POST(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  let key = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
  if (!key) {
    const row = await db.integrationConfig.findUnique({ where: { provider: "anthropic" } });
    key = row?.keyEnc ? decryptSecret(row.keyEnc) ?? "" : "";
  }
  if (!key) return NextResponse.json({ ok: false, message: "No key to test — enter one first." });
  return NextResponse.json(await testClaudeKey(key));
}
