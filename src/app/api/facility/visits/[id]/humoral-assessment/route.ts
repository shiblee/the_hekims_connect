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

async function assertOwnedVisit(id: string, facilityId: string) {
  return db.visit.findFirst({ where: { id, facilityId }, select: { id: true } });
}

const VALID_HUMORS = ["Safra", "Dam", "Sauda", "Balgham"];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth || (auth.type !== "facility" && auth.type !== "staff")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const facilityId = await resolveFacilityId(auth);
  if (!facilityId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const visit = await assertOwnedVisit(id, facilityId);
  if (!visit) return NextResponse.json({ error: "Visit not found" }, { status: 404 });

  const body = await req.json();
  const dominantOverride = body.dominantOverride;
  if (dominantOverride !== null && !VALID_HUMORS.includes(dominantOverride)) {
    return NextResponse.json({ error: "Invalid humor" }, { status: 400 });
  }

  const existing = await db.humoralAssessment.findUnique({ where: { visitId: id } });
  if (!existing) return NextResponse.json({ error: "No humoral assessment recorded yet for this visit" }, { status: 404 });

  const humoralAssessment = await db.humoralAssessment.update({
    where: { visitId: id },
    data: { dominantOverride },
    select: {
      id: true, safraPercent: true, damPercent: true, saudaPercent: true, balghamPercent: true,
      dominant: true, dominantOverride: true, breakdown: true, computedAt: true,
    },
  });
  return NextResponse.json({ humoralAssessment });
}
