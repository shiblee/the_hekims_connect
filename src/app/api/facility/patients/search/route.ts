import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/api-auth";

// Scoped to patients this facility has actually seen before (a prior Visit or
// Appointment) — not platform-wide. A clinic shouldn't see another clinic's
// patients just by searching a phone number.
export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth || auth.type !== "facility") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const mobile = (searchParams.get("mobile") || "").trim();
  const name = (searchParams.get("name") || "").trim();
  const dob = (searchParams.get("dob") || "").trim();

  if (!mobile && !name && !dob) {
    return NextResponse.json({ candidates: [] });
  }

  const searchConditions: Record<string, unknown>[] = [];
  if (mobile) searchConditions.push({ phone: { contains: mobile } });
  if (name) searchConditions.push({ name: { contains: name } });
  if (dob) searchConditions.push({ dob });

  const candidates = await db.patient.findMany({
    where: {
      AND: [
        { OR: [{ visits: { some: { facilityId: auth.id } } }, { appointments: { some: { facilityId: auth.id } } }] },
        { OR: searchConditions },
      ],
    },
    select: {
      id: true, patientCode: true, name: true, titlePrefix: true, relationship: true,
      gender: true, dob: true, dobApprox: true, maritalStatus: true,
      phone: true, email: true, avatarColor: true,
      address: true, state: true, city: true,
      emergencyContact: true, emergencyContactName: true,
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  // Last time this specific facility saw the patient, so the receptionist can
  // tell at a glance whether this is a returning or long-lapsed patient.
  const withLastVisit = await Promise.all(
    candidates.map(async (c) => {
      const lastVisit = await db.visit.findFirst({
        where: { patientId: c.id, facilityId: auth.id },
        orderBy: { visitDate: "desc" },
        select: { visitDate: true },
      });
      return { ...c, lastVisitAt: lastVisit?.visitDate || null };
    })
  );

  // Deterministic match signal (not ML) — a plain count of which provided
  // search fields actually matched, shown to the receptionist as "possible match".
  const providedCount = [mobile, name, dob].filter(Boolean).length;
  const withScore = withLastVisit.map((c) => {
    let matched = 0;
    if (mobile && c.phone === mobile) matched += 1;
    if (name && c.name.toLowerCase().includes(name.toLowerCase())) matched += 1;
    if (dob && c.dob === dob) matched += 1;
    return { ...c, matchScore: providedCount ? Math.round((matched / providedCount) * 100) : 0 };
  });

  withScore.sort((a, b) => b.matchScore - a.matchScore);

  return NextResponse.json({ candidates: withScore });
}
