import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/api-auth";
import { DURATION_UNITS } from "@/lib/chronology";

async function authorize(req: NextRequest, visitId: string) {
  const auth = await getAuthUser(req);
  if (!auth || (auth.type !== "facility" && auth.type !== "staff")) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  let facilityId: string | null = auth.type === "facility" ? auth.id : null;
  if (auth.type === "staff") {
    const staff = await db.staff.findUnique({ where: { id: auth.id }, select: { facilityId: true } });
    facilityId = staff?.facilityId ?? null;
  }
  if (!facilityId) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const visit = await db.visit.findFirst({ where: { id: visitId, facilityId }, select: { id: true } });
  if (!visit) return { error: NextResponse.json({ error: "Visit not found" }, { status: 404 }) };
  return { auth };
}

const SELECT = {
  onsetPatterns: true, durationValue: true, durationUnit: true, onsetDate: true,
  durationSource: true, sourceComplaint: true, note: true, updatedAt: true,
};

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { error } = await authorize(req, id);
  if (error) return error;
  const chronology = await db.visitChronology.findUnique({ where: { visitId: id }, select: SELECT });
  return NextResponse.json({ chronology });
}

/** Body { onsetPatterns, durationValue, durationUnit, onsetDate (yyyy-mm-dd), durationSource, sourceComplaint, note }. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { auth, error } = await authorize(req, id);
  if (error) return error;

  const b = await req.json().catch(() => ({}));
  const patterns: string[] = Array.isArray(b.onsetPatterns)
    ? [...new Set<string>(b.onsetPatterns.filter((p: unknown): p is string => typeof p === "string" && !!p.trim()).map((p: string) => p.trim()))]
    : [];
  const value = Number(b.durationValue);
  const unit = DURATION_UNITS.some((u) => u.value === b.durationUnit) ? b.durationUnit : null;
  const date = typeof b.onsetDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.onsetDate) ? new Date(`${b.onsetDate}T00:00:00Z`) : null;

  const data = {
    onsetPatterns: JSON.stringify(patterns),
    durationValue: Number.isFinite(value) && value > 0 ? value : null,
    durationUnit: unit,
    onsetDate: date,
    durationSource: b.durationSource === "manual" ? "manual" : "auto",
    sourceComplaint: typeof b.sourceComplaint === "string" && b.sourceComplaint.trim() ? b.sourceComplaint.trim() : null,
    note: typeof b.note === "string" && b.note.trim() ? b.note.trim().slice(0, 2000) : null,
    recordedById: auth!.type === "staff" ? auth!.id : null,
  };
  const chronology = await db.visitChronology.upsert({
    where: { visitId: id }, update: data, create: { visitId: id, ...data }, select: SELECT,
  });
  return NextResponse.json({ chronology });
}
