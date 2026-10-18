import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/api-auth";
import { formatAge } from "@/lib/age";
import { generateHumoralClues, geminiQuotaRecentlyHit } from "@/lib/gemini";

async function resolveFacilityId(auth: { id: string; type: "facility" | "patient" | "staff" }): Promise<string | null> {
  if (auth.type === "facility") return auth.id;
  if (auth.type === "staff") {
    const staff = await db.staff.findUnique({ where: { id: auth.id }, select: { facilityId: true } });
    return staff?.facilityId ?? null;
  }
  return null;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth || (auth.type !== "facility" && auth.type !== "staff")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const facilityId = await resolveFacilityId(auth);
  if (!facilityId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const visit = await db.visit.findFirst({
    where: { id, facilityId },
    select: {
      patient: { select: { name: true, gender: true, dob: true } },
      humoralAssessment: {
        select: { safraPercent: true, damPercent: true, saudaPercent: true, balghamPercent: true, dominant: true, breakdown: true },
      },
    },
  });
  if (!visit) return NextResponse.json({ error: "Visit not found" }, { status: 404 });
  if (!visit.humoralAssessment) return NextResponse.json({ clue: null, unavailable: true, reason: "no_data" });

  let breakdown: { source: string; safra: number; dam: number; sauda: number; balgham: number }[] = [];
  try { breakdown = JSON.parse(visit.humoralAssessment.breakdown || "[]"); } catch { breakdown = []; }

  const clue = await generateHumoralClues(
    { name: visit.patient.name, gender: visit.patient.gender, ageLabel: formatAge(visit.patient.dob) },
    { ...visit.humoralAssessment, breakdown }
  );

  if (!clue) return NextResponse.json({ clue: null, unavailable: true, reason: geminiQuotaRecentlyHit() ? "quota" : "unavailable" });

  await db.humoralAssessment.update({
    where: { visitId: id },
    data: { aiClue: clue, aiClueGeneratedAt: new Date() },
  });
  return NextResponse.json({ clue });
}
