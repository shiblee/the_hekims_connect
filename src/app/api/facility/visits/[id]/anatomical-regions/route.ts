import { NextRequest, NextResponse } from "next/server";
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

async function authorize(req: NextRequest, visitId: string) {
  const auth = await getAuthUser(req);
  if (!auth || (auth.type !== "facility" && auth.type !== "staff")) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const facilityId = await resolveFacilityId(auth);
  if (!facilityId) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const visit = await db.visit.findFirst({ where: { id: visitId, facilityId }, select: { id: true } });
  if (!visit) return { error: NextResponse.json({ error: "Visit not found" }, { status: 404 }) };
  return { auth };
}

const SELECT = { id: true, regions: true, createdAt: true, updatedAt: true };

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { error } = await authorize(req, id);
  if (error) return error;
  const selection = await db.anatomicalRegionSelection.findUnique({ where: { visitId: id }, select: SELECT });
  return NextResponse.json({ selection });
}

/** Body { regions: string[] } — region labels in selection order, primary first. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { auth, error } = await authorize(req, id);
  if (error) return error;

  const body = await req.json().catch(() => ({}));
  const regions: string[] = Array.isArray(body.regions)
    ? [...new Set<string>(body.regions.filter((r: unknown): r is string => typeof r === "string" && !!r.trim()).map((r: string) => r.trim()))]
    : [];
  const recordedById = auth!.type === "staff" ? auth!.id : null;

  const selection = await db.anatomicalRegionSelection.upsert({
    where: { visitId: id },
    update: { regions: JSON.stringify(regions), recordedById },
    create: { visitId: id, regions: JSON.stringify(regions), recordedById },
    select: SELECT,
  });
  return NextResponse.json({ selection });
}
