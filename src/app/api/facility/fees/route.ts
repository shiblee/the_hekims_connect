import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/api-auth";
import { logClinicEvent } from "@/lib/clinic-audit";

const KINDS = ["registration", "consultation", "follow_up", "other"];

/** The clinic's fee list. `?all=1` includes switched-off fees (for the settings screen). */
export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth || auth.type !== "facility") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const all = req.nextUrl.searchParams.get("all") === "1";
  const fees = await db.facilityFee.findMany({ where: { facilityId: auth.id, ...(all ? {} : { active: true }) }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
  return NextResponse.json({ fees });
}

/** Body { id?, name, amount, kind, active } — create (no id) or update. Fees are switched off, never deleted. */
export async function PUT(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth || auth.type !== "facility") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const name = String(b.name || "").trim().slice(0, 80);
  const amount = Math.round(parseFloat(b.amount) * 100) / 100;
  if (!name) return NextResponse.json({ error: "Fee name is required" }, { status: 400 });
  if (!Number.isFinite(amount) || amount < 0 || amount > 1_000_000) return NextResponse.json({ error: "Enter a valid amount" }, { status: 400 });
  const kind = KINDS.includes(b.kind) ? b.kind : "consultation";
  if (b.id) {
    const prev = await db.facilityFee.findFirst({ where: { id: b.id, facilityId: auth.id } });
    if (!prev) return NextResponse.json({ error: "Fee not found" }, { status: 404 });
    const fee = await db.facilityFee.update({ where: { id: b.id }, data: { name, amount, kind, active: b.active !== false } });
    const changes = [prev.name !== name && `name "${prev.name}" → "${name}"`, prev.amount !== amount && `amount ₹${prev.amount} → ₹${amount}`, prev.active !== fee.active && (fee.active ? "switched on" : "switched off")].filter(Boolean);
    if (changes.length) await logClinicEvent(req, auth, { action: "facility.updated", summary: `Fee "${name}": ${changes.join(", ")}`, entityType: "fee", entityId: fee.id, entityLabel: name });
    return NextResponse.json({ fee });
  }
  const count = await db.facilityFee.count({ where: { facilityId: auth.id } });
  const fee = await db.facilityFee.create({ data: { facilityId: auth.id, name, amount, kind, sortOrder: count } });
  await logClinicEvent(req, auth, { action: "facility.updated", summary: `Added fee "${name}" ₹${amount}`, entityType: "fee", entityId: fee.id, entityLabel: name });
  return NextResponse.json({ fee });
}
