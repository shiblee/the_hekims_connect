import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, logAdminActivity } from "@/lib/admin-auth";
import { getClientIp } from "@/lib/request-info";
import { runChiefComplaintBot } from "@/lib/chief-complaint-bot";

export async function POST(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const run = await runChiefComplaintBot("manual");

  await logAdminActivity(
    session.admin.id,
    "chief_complaint_bot_run",
    `Ran the Unani Complaint Assistant manually — ${run.status}${run.suggestionsCount ? `, ${run.suggestionsCount} new suggestion(s)` : ""}`,
    getClientIp(req)
  );

  return NextResponse.json({ run });
}
