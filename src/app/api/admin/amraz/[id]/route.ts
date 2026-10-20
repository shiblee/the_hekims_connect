import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, logAdminActivity } from "@/lib/admin-auth";
import { getClientIp } from "@/lib/request-info";
import { marzData } from "../shared";

/** Body: fields to change, and/or { review: "approved" | "rejected" | "draft" } — a physician's review decision. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { id } = await params;
  const existing = await db.marzEntry.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const b = await req.json().catch(() => ({}));
  const { data, error } = marzData(b, false);
  if (error) return NextResponse.json({ error }, { status: 400 });
  if (["approved", "rejected", "draft"].includes(b.review)) {
    data.reviewStatus = b.review;
    data.reviewedBy = b.review === "draft" ? null : session.admin.name;
    data.reviewedAt = b.review === "draft" ? null : new Date();
  } else if (Object.keys(data).some((k) => k !== "active") && existing.reviewStatus === "approved") {
    // Changing an approved entry's clinical content sends it back for review.
    data.reviewStatus = "draft"; data.reviewedBy = null; data.reviewedAt = null;
  }
  const entry = await db.marzEntry.update({ where: { id }, data });
  const what = b.review ? `${b.review === "approved" ? "Approved" : b.review === "rejected" ? "Rejected" : "Reopened"} Amraz entry "${entry.label}"` : `Updated Amraz entry "${entry.label}"${entry.reviewStatus === "draft" && existing.reviewStatus === "approved" ? " (back to unverified)" : ""}`;
  await logAdminActivity(session.admin.id, "amraz_updated", what, getClientIp(req));
  return NextResponse.json({ entry });
}
