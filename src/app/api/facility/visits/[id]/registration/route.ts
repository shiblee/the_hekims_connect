import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/api-auth";

// Everything the Registration wizard needs to re-open pre-filled for an
// already-registered visit, so a junior doctor can review/correct what
// reception captured before moving on to Vitals — one call instead of the
// four separate ones the wizard's own first-time flow makes.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth || auth.type !== "facility") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const visit = await db.visit.findFirst({
    where: { id, facilityId: auth.id },
    select: {
      id: true, visitCode: true, doctorId: true,
      payments: { select: { amount: true, mode: true }, orderBy: { createdAt: "desc" }, take: 1 },
      patient: {
        select: {
          id: true, patientCode: true, name: true, titlePrefix: true, relationship: true,
          gender: true, dob: true, dobApprox: true, maritalStatus: true, phone: true,
          address: true, state: true, city: true, emergencyContact: true, emergencyContactName: true,
        },
      },
      intake: {
        select: { chiefComplaints: true, narrative: true, onsetTimeline: true, allergies: true, medications: true, mobility: true },
      },
    },
  });
  if (!visit) {
    return NextResponse.json({ error: "Visit not found" }, { status: 404 });
  }

  let chiefComplaintIds: string[] = [];
  if (visit.intake?.chiefComplaints) {
    const labels: string[] = (() => { try { return JSON.parse(visit.intake!.chiefComplaints); } catch { return []; } })();
    if (labels.length) {
      // Match case/whitespace-insensitively in JS (SQLite's Prisma mode
      // doesn't support "insensitive") — an exact-only match would silently
      // drop a complaint from this pre-fill (and then, if the form is saved
      // without re-adding it, from VisitIntake permanently) over nothing
      // more than an admin re-casing a label after this intake was recorded.
      const normalize = (s: string) => s.trim().toLowerCase();
      const wanted = new Set(labels.map(normalize));
      const allComplaints = await db.chiefComplaint.findMany({ select: { id: true, label: true } });
      const matched = allComplaints.filter((c) => wanted.has(normalize(c.label)));
      chiefComplaintIds = matched.map((c) => c.id);
    }
  }

  return NextResponse.json({
    patient: visit.patient,
    visit: { id: visit.id, visitCode: visit.visitCode, doctorId: visit.doctorId, lastPayment: visit.payments[0] || null },
    intake: visit.intake ? { ...visit.intake, chiefComplaintIds } : null,
  });
}
