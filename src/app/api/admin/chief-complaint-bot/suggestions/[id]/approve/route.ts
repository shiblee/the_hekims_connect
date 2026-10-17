import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, logAdminActivity } from "@/lib/admin-auth";
import { getClientIp } from "@/lib/request-info";
import { deriveChiefComplaintKey } from "@/lib/chief-complaint-key";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  const suggestion = await db.chiefComplaintSuggestion.findUnique({ where: { id } });
  if (!suggestion) return NextResponse.json({ error: "Suggestion not found" }, { status: 404 });
  if (suggestion.status !== "pending") {
    return NextResponse.json({ error: `This suggestion was already ${suggestion.status}` }, { status: 409 });
  }

  const key = await deriveChiefComplaintKey(suggestion.label);
  if (!key) {
    return NextResponse.json({ error: "Could not derive a key from this suggestion's label" }, { status: 400 });
  }

  const maxOrder = await db.chiefComplaint.aggregate({ _max: { sortOrder: true } });
  const complaint = await db.chiefComplaint.create({
    data: {
      key, label: suggestion.label, labelLocal: suggestion.labelLocal,
      category: suggestion.category,
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
    },
  });

  const updated = await db.chiefComplaintSuggestion.update({
    where: { id },
    data: {
      status: "approved", reviewedById: session.admin.id, reviewedAt: new Date(),
      resultingComplaintId: complaint.id,
    },
  });

  await logAdminActivity(
    session.admin.id,
    "chief_complaint_suggestion_approved",
    `Approved suggested chief complaint "${suggestion.label}" (${suggestion.category})`,
    getClientIp(req)
  );

  return NextResponse.json({ suggestion: updated, complaint });
}
