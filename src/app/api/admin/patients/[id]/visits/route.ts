import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";

// Unlike the facility-side GET /api/facility/visits?patientId=, this isn't scoped
// to a single facility — an admin sees every facility's visits for this patient.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  const visits = await db.visit.findMany({
    where: { patientId: id },
    select: {
      id: true, visitCode: true, status: true, reasonForVisit: true, visitDate: true, createdAt: true,
      facility: { select: { id: true, facilityName: true } },
      doctor: { select: { id: true, name: true, staffCode: true } },
      payments: { select: { id: true, paymentCode: true, amount: true, mode: true, status: true, createdAt: true } },
    },
    orderBy: { visitDate: "desc" },
  });

  return NextResponse.json({ visits });
}
