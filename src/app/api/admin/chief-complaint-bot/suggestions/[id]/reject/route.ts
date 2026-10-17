import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, logAdminActivity } from "@/lib/admin-auth";
import { getClientIp } from "@/lib/request-info";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  const suggestion = await db.chiefComplaintSuggestion.findUnique({ where: { id } });
  if (!suggestion) return NextResponse.json({ error: "Suggestion not found" }, { status: 404 });
  if (suggestion.status !== "pending") {
    return NextResponse.json({ error: `This suggestion was already ${suggestion.status}` }, { status: 409 });
  }

  const updated = await db.chiefComplaintSuggestion.update({
    where: { id },
    data: { status: "rejected", reviewedById: session.admin.id, reviewedAt: new Date() },
  });

  await logAdminActivity(
    session.admin.id,
    "chief_complaint_suggestion_rejected",
    `Rejected suggested chief complaint "${suggestion.label}" (${suggestion.category})`,
    getClientIp(req)
  );

  return NextResponse.json({ suggestion: updated });
}
