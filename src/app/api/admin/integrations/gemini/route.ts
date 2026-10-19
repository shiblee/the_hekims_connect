import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, logAdminActivity } from "@/lib/admin-auth";
import { getClientIp } from "@/lib/request-info";
import { decryptSecret, encryptSecret } from "@/lib/secret-crypto";
import { testGeminiKey } from "@/lib/gemini";

/**
 * Admin → Settings → AI service: the Google Gemini key (stored encrypted, never sent back in full)
 * and the on/off switch every AI feature respects.
 */
async function summary() {
  const row = await db.integrationConfig.findUnique({ where: { provider: "gemini" } });
  const key = row?.keyEnc ? decryptSecret(row.keyEnc) : null;
  return {
    configured: !!key,
    active: !!row?.active && !!key,
    keyHint: key ? `•••• ${key.slice(-4)}` : null,
    updatedAt: row?.updatedAt ?? null,
  };
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

  if (body.removeKey === true) { data.keyEnc = null; data.active = false; changes.push("key removed, AI switched off"); }
  else if (typeof body.apiKey === "string") {
    const key = body.apiKey.trim();
    if (key.length < 20 || /\s/.test(key)) return NextResponse.json({ error: "That doesn't look like a Gemini API key — copy it again from Google AI Studio." }, { status: 400 });
    data.keyEnc = encryptSecret(key);
    changes.push(`key replaced (ends ${key.slice(-4)})`);
  }
  if (typeof body.active === "boolean" && body.removeKey !== true) {
    data.active = body.active;
    changes.push(`AI switched ${body.active ? "on" : "off"}`);
  }
  if (!changes.length) return NextResponse.json({ error: "Nothing to change" }, { status: 400 });

  const existing = await db.integrationConfig.findUnique({ where: { provider: "gemini" } });
  if (data.active && !(data.keyEnc ?? existing?.keyEnc)) return NextResponse.json({ error: "Add a key before switching the AI service on." }, { status: 400 });
  await db.integrationConfig.upsert({
    where: { provider: "gemini" },
    create: { provider: "gemini", keyEnc: data.keyEnc ?? null, active: data.active ?? false },
    update: data,
  });
  await logAdminActivity(session.admin.id, "ai_service_updated", `AI service (Gemini): ${changes.join("; ")}`, getClientIp(req));
  return NextResponse.json(await summary());
}

/** Body { apiKey?: string } — tests the given key, or the saved one. Works even while switched off. */
export async function POST(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  let key = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
  if (!key) {
    const row = await db.integrationConfig.findUnique({ where: { provider: "gemini" } });
    key = row?.keyEnc ? decryptSecret(row.keyEnc) ?? "" : "";
  }
  if (!key) return NextResponse.json({ ok: false, message: "No key to test — enter one first." });
  return NextResponse.json(await testGeminiKey(key));
}
