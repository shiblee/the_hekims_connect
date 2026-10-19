import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/api-auth";
import { signPass } from "@/lib/session-token";

// Scoped to patients this facility has actually seen before (a prior Visit or
// Appointment) — not platform-wide. A clinic shouldn't see another clinic's
// patients just by searching a phone number.
const OTHER_SELECT = { id: true, patientCode: true, name: true, gender: true, dob: true, phone: true, avatarColor: true } as const;

export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth || auth.type !== "facility") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const mobile = (searchParams.get("mobile") || "").trim();
  const name = (searchParams.get("name") || "").trim();
  const dob = (searchParams.get("dob") || "").trim();

  if (!mobile && !name && !dob && !searchParams.get("code")) {
    return NextResponse.json({ candidates: [] });
  }

  const searchConditions: Record<string, unknown>[] = [];
  if (mobile) searchConditions.push({ phone: { contains: mobile } });
  if (name) searchConditions.push({ name: { contains: name } });
  if (dob) searchConditions.push({ dob });
  const codeParam = (searchParams.get("code") || "").trim().toUpperCase();
  if (codeParam) searchConditions.push({ patientCode: codeParam });

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

  // Patients registered at OTHER clinics — only on an exact match (full mobile + the same name,
  // or the exact patient ID), with minimal details, and a short-lived signed pass that lets
  // this clinic start a visit for them. Nothing about their visits elsewhere is shared.
  const norm = (v: string) => v.toLowerCase().replace(/\s+/g, " ").trim();
  const code = (searchParams.get("code") || "").trim().toUpperCase();
  const here = new Set(withScore.map((c) => c.id));
  const exact = /^[6-9]\d{9}$/.test(mobile) && name
    ? (await db.patient.findMany({ where: { phone: mobile, active: true }, select: OTHER_SELECT, take: 20 })).filter((p) => norm(p.name) === norm(name))
    : [];
  if (code) {
    const byCode = await db.patient.findFirst({ where: { patientCode: code, active: true }, select: OTHER_SELECT });
    if (byCode) exact.push(byCode);
  }
  const elsewhere = await Promise.all(exact.filter((p, i, arr) => !here.has(p.id) && arr.findIndex((x) => x.id === p.id) === i).map(async (p) => ({
    id: p.id, patientCode: p.patientCode, name: p.name, gender: p.gender, dob: p.dob, avatarColor: p.avatarColor,
    phone: p.phone ? `${p.phone.slice(0, 2)}••••••${p.phone.slice(-2)}` : null,
    titlePrefix: null, relationship: null, maritalStatus: null, email: null, address: null, state: null, city: null, emergencyContact: null, emergencyContactName: null,
    lastVisitAt: null, matchScore: 100, otherClinic: true,
    linkPass: await signPass("link", [p.id, auth.id], 120),
  })));

  return NextResponse.json({ candidates: [...withScore, ...elsewhere] });
}
